import { NotificationJobType, Role, Sex } from '@shared/domain/enums';
import {
  ConflictError,
  DependencyUnavailableError,
  InvalidEntryError,
} from '@src/application/errors/application.errors';
import { Environment, createEnvironment, seedUser } from '@test/support/fakes';
import { RegisterDonorUseCase } from '@src/application/use-cases/register-donor.use-case';

describe('RegisterDonorUseCase', () => {
  let env: Environment;
  let useCase: RegisterDonorUseCase;

  const input = {
    email: 'donor@example.com',
    password: 'password1234',
    name: 'Maria Doadora',
    cpf: '12345678901',
    birthDate: '1995-04-12',
    sex: Sex.F,
    weightKg: 60,
    healthDataConsent: true,
  };

  beforeEach(() => {
    env = createEnvironment();
    useCase = new RegisterDonorUseCase(
      env.users,
      env.hasher,
      env.eligibility,
      env.clock,
      env.ids,
      env.sessions,
      env.unitOfWork,
      env.verificationNotices,
    );
  });

  it('cria o usuario, orquestra a criação do doador e devolve os tokens', async () => {
    const result = await useCase.execute(input);

    expect(env.eligibility.created).toEqual([
      expect.objectContaining({ userId: result.user.id, cpf: input.cpf }),
    ]);
    expect(result.user.donorId).toBe('donor-1');
    expect(result.user.role).toBe(Role.DONOR);
    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBeDefined();
    const saved = await env.users.findById(result.user.id);
    expect(saved?.donorId).toBe('donor-1');
    expect(saved?.passwordHash).toBe('hash:password1234');
  });

  it('grava as boas-vindas no outbox, com o link de confirmação do e-mail', async () => {
    const result = await useCase.execute(input);

    expect(env.accountNotices.payloads()).toEqual([
      {
        type: NotificationJobType.WELCOME,
        userId: result.user.id,
        donorId: 'donor-1',
        name: input.name,
        recipientEmail: input.email,
        verificationUrl: expect.stringMatching(
          new RegExp(`^http://localhost:5173/verify-email\\?token=vt%7C${result.user.id}%7C`),
        ),
      },
    ]);
    // A conta nova começa sem o e-mail confirmado, aqui e no doador.
    expect(result.user.emailVerified).toBe(false);
    expect(env.eligibility.created[0]).toMatchObject({ emailVerified: false });
  });

  it('cadastro recusado pelo eligibility: nenhum e-mail de boas-vindas', async () => {
    env.eligibility.failure = new ConflictError('CPF já cadastrado.');

    await expect(useCase.execute(input)).rejects.toThrow();

    expect(env.accountNotices.items.size).toBe(0);
  });

  it('o doador recebe o mesmo e-mail normalizado da conta', async () => {
    await useCase.execute({ ...input, email: '  Maria.Doadora@Example.COM ' });

    expect(env.eligibility.created[0]?.email).toBe('maria.doadora@example.com');
  });

  it('rejeita com e-mail duplicado sem chamar o eligibility-service', async () => {
    await seedUser(env);

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(ConflictError);
    expect(env.eligibility.created).toHaveLength(0);
  });

  it('desfaz o usuario criado se o eligibility-service rejeitar o doador', async () => {
    env.eligibility.failure = new ConflictError('CPF já cadastrado.');

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(ConflictError);
    expect(env.users.items.size).toBe(0);
    expect(env.refreshTokens.items.size).toBe(0);
  });

  it('repassa ao eligibility-service as declarações do doador', async () => {
    await useCase.execute({
      ...input,
      birthDate: '2009-05-01',
      guardianName: 'Responsável',
      guardianConsent: true,
      lastDonationDate: '2026-06-01',
    });

    expect(env.eligibility.created[0]).toMatchObject({
      guardianName: 'Responsável',
      guardianConsent: true,
      lastDonationDate: '2026-06-01',
    });
  });

  it('dados recusados pelo eligibility (ex.: menor sem responsável): desfaz o usuário e repassa o 400', async () => {
    env.eligibility.failure = new InvalidEntryError(
      'Menores de 18 anos precisam informar o responsável.',
    );

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(InvalidEntryError);
    expect(env.users.items.size).toBe(0);
  });

  describe('resultado incerto (a resposta do eligibility-service se perdeu)', () => {
    const lost = () => new DependencyUnavailableError('timeout');

    it('conclui o cadastro (roll-forward) se o doador chegou a ser criado', async () => {
      env.eligibility.failure = lost();
      // o eligibility criou o doador, mas a resposta não voltou: ele conhece o userId gerado
      const original = env.eligibility.createDonor.bind(env.eligibility);
      env.eligibility.createDonor = async (donor) => {
        env.eligibility.existing.set(donor.userId, 'donor-77');
        return original(donor);
      };

      const result = await useCase.execute(input);

      expect(result.user.donorId).toBe('donor-77');
      expect((await env.users.findById(result.user.id))?.donorId).toBe('donor-77');
      expect(result.accessToken).toBeDefined();
    });

    it('desfaz o usuário se o doador comprovadamente não existe', async () => {
      env.eligibility.failure = lost();

      await expect(useCase.execute(input)).rejects.toBeInstanceOf(DependencyUnavailableError);

      expect(env.users.items.size).toBe(0);
    });

    it('deixa o usuário pendente (sem apagar às cegas) se nem a consulta responde', async () => {
      env.eligibility.failure = lost();
      env.eligibility.lookupFailure = new DependencyUnavailableError('fora do ar');

      await expect(useCase.execute(input)).rejects.toBe(env.eligibility.failure);

      const [pending] = [...env.users.items.values()];
      expect(pending).toBeDefined();
      expect(pending.donorId).toBeNull();
    });

    it('conflito é definitivo: nem consulta o eligibility antes de desfazer', async () => {
      env.eligibility.failure = new ConflictError('CPF já cadastrado.');
      env.eligibility.lookupFailure = new Error('não deveria ser chamado');

      await expect(useCase.execute(input)).rejects.toBeInstanceOf(ConflictError);

      expect(env.users.items.size).toBe(0);
    });
  });

  describe('repetir o cadastro com o usuário ainda pendente', () => {
    const lost = () => new DependencyUnavailableError('timeout');

    it('retoma o cadastro (mesmo e-mail e senha) em vez de dar "e-mail já cadastrado"', async () => {
      env.eligibility.failure = lost();
      env.eligibility.lookupFailure = new DependencyUnavailableError('fora do ar');
      await expect(useCase.execute(input)).rejects.toBe(env.eligibility.failure);
      const [pending] = [...env.users.items.values()];

      env.eligibility.failure = null;
      env.eligibility.lookupFailure = null;
      const result = await useCase.execute(input);

      expect(result.user.id).toBe(pending.id);
      expect(result.user.donorId).toBe('donor-1');
      expect(env.users.items.size).toBe(1);
      expect(env.eligibility.created).toHaveLength(1);
    });

    it('se o doador já existe no eligibility, só vincula (não cria de novo)', async () => {
      const pending = await seedUser(env, {}, input.password);
      env.eligibility.existing.set(pending.id, 'donor-42');

      const result = await useCase.execute(input);

      expect(result.user.donorId).toBe('donor-42');
      expect(env.eligibility.created).toHaveLength(0);
    });

    it('senha diferente continua sendo conflito (não retoma conta alheia)', async () => {
      await seedUser(env, {}, 'outra-senha-qualquer');

      await expect(useCase.execute(input)).rejects.toBeInstanceOf(ConflictError);
      expect(env.eligibility.created).toHaveLength(0);
    });

    it('usuário já vinculado a um doador continua sendo conflito', async () => {
      await seedUser(env, { donorId: 'donor-9' }, input.password);

      await expect(useCase.execute(input)).rejects.toBeInstanceOf(ConflictError);
    });

    it('na retomada, se a consulta falhar o usuário continua pendente', async () => {
      const pending = await seedUser(env, {}, input.password);
      env.eligibility.lookupFailure = new DependencyUnavailableError('fora do ar');

      await expect(useCase.execute(input)).rejects.toBeInstanceOf(DependencyUnavailableError);

      expect(await env.users.findById(pending.id)).not.toBeNull();
      expect(env.eligibility.created).toHaveLength(0);
    });

    it('na retomada, CPF em conflito desfaz o usuário pendente', async () => {
      const pending = await seedUser(env, {}, input.password);
      env.eligibility.failure = new ConflictError('CPF já cadastrado.');

      await expect(useCase.execute(input)).rejects.toBeInstanceOf(ConflictError);

      expect(await env.users.findById(pending.id)).toBeNull();
    });
  });
});
