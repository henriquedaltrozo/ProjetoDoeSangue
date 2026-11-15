import { NotificationJobType } from '@shared/domain/enums';
import {
  ConflictError,
  DependencyUnavailableError,
  InvalidEntryError,
  NotAuthenticatedError,
} from '@src/application/errors/application.errors';
import { UpdateMyAccountUseCase } from '@src/application/use-cases/update-my-account.use-case';
import { type Environment, createEnvironment, seedUser } from '@test/support/fakes';

describe('UpdateMyAccountUseCase', () => {
  let env: Environment;
  let useCase: UpdateMyAccountUseCase;

  beforeEach(() => {
    env = createEnvironment();
    useCase = new UpdateMyAccountUseCase(
      env.users,
      env.hasher,
      env.eligibility,
      env.unitOfWork,
      env.verificationNotices,
    );
  });

  it('troca o nome aqui e no doador, sem pedir a senha', async () => {
    const user = await seedUser(env, { donorId: 'donor-1' });

    const out = await useCase.execute(user.id, { name: '  Maria Souza ' });

    expect(out.name).toBe('Maria Souza');
    expect(env.eligibility.identityUpdates).toEqual([
      { donorId: 'donor-1', data: { completeName: 'Maria Souza' } },
    ]);
  });

  it('pedir a troca de e-mail (com a senha) deixa o novo pendente e manda o link para ele', async () => {
    const user = await seedUser(env, { donorId: 'donor-1' });

    const out = await useCase.execute(user.id, {
      email: 'Nova@Example.com',
      currentPassword: 'password-correct',
    });

    // O login só muda depois da confirmação: aqui e no doador, nada muda ainda.
    expect(out.email).toBe(user.email);
    expect(out.pendingEmail).toBe('nova@example.com');
    expect((await env.users.findById(user.id))?.email).toBe(user.email);
    expect(env.eligibility.identityUpdates).toHaveLength(0);
    expect(env.accountNotices.payloads()).toEqual([
      expect.objectContaining({
        type: NotificationJobType.EMAIL_VERIFICATION,
        recipientEmail: 'nova@example.com',
        purpose: 'change',
      }),
    ]);
  });

  it('voltar ao e-mail atual cancela a troca pendente', async () => {
    const user = await seedUser(env, { donorId: 'donor-1' });
    await useCase.execute(user.id, {
      email: 'nova@example.com',
      currentPassword: 'password-correct',
    });

    const out = await useCase.execute(user.id, { email: user.email });

    expect(out.pendingEmail).toBeNull();
  });

  it('trocar só o nome não envia aviso de e-mail', async () => {
    const user = await seedUser(env, { donorId: 'donor-1' });

    await useCase.execute(user.id, { name: 'Maria Souza' });

    expect(env.accountNotices.items.size).toBe(0);
  });

  it('recusa trocar o e-mail sem a senha atual ou com a senha errada', async () => {
    const user = await seedUser(env, { donorId: 'donor-1' });

    await expect(useCase.execute(user.id, { email: 'nova@example.com' })).rejects.toBeInstanceOf(
      InvalidEntryError,
    );
    await expect(
      useCase.execute(user.id, { email: 'nova@example.com', currentPassword: 'errada' }),
    ).rejects.toBeInstanceOf(InvalidEntryError);
    expect(env.eligibility.identityUpdates).toHaveLength(0);
    expect(env.users.saves).toBe(0);
  });

  it('recusa um e-mail que já é de outra conta', async () => {
    await seedUser(env, { email: 'outra@example.com' });
    const user = await seedUser(env, { email: 'eu@example.com' });

    await expect(
      useCase.execute(user.id, { email: 'outra@example.com', currentPassword: 'password-correct' }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('sem mudança de fato não chama o eligibility nem grava', async () => {
    const user = await seedUser(env, { donorId: 'donor-1' });

    await useCase.execute(user.id, { name: 'Maria Doadora', email: 'DONOR@example.com' });

    expect(env.eligibility.identityUpdates).toHaveLength(0);
    expect(env.users.saves).toBe(0);
  });

  it('se o eligibility falhar, nada muda aqui', async () => {
    const user = await seedUser(env, { donorId: 'donor-1' });
    env.eligibility.identityFailure = new DependencyUnavailableError('fora do ar');

    await expect(useCase.execute(user.id, { name: 'Maria Souza' })).rejects.toBeInstanceOf(
      DependencyUnavailableError,
    );
    expect((await env.users.findById(user.id))?.name).toBe('Maria Doadora');
  });

  it('se a gravação daqui falhar, o doador volta ao nome anterior', async () => {
    const user = await seedUser(env, { donorId: 'donor-1' });
    jest.spyOn(env.users, 'save').mockRejectedValueOnce(new Error('banco fora'));

    await expect(useCase.execute(user.id, { name: 'Maria Souza' })).rejects.toThrow('banco fora');
    expect(env.eligibility.identityUpdates.map((u) => u.data)).toEqual([
      { completeName: 'Maria Souza' },
      { completeName: 'Maria Doadora' },
    ]);
  });

  it('admin (sem doador) troca o nome só aqui', async () => {
    const user = await seedUser(env, { donorId: null, email: 'adm@example.com' });

    await useCase.execute(user.id, { name: 'Admin Novo' });

    expect(env.eligibility.identityUpdates).toHaveLength(0);
    expect((await env.users.findById(user.id))?.name).toBe('Admin Novo');
  });

  it('usuário inexistente ou inativo não é autenticado', async () => {
    const inactive = await seedUser(env, { active: false });
    await expect(useCase.execute('nao-existe', { name: 'X Y Z' })).rejects.toBeInstanceOf(
      NotAuthenticatedError,
    );
    await expect(useCase.execute(inactive.id, { name: 'X Y Z' })).rejects.toBeInstanceOf(
      NotAuthenticatedError,
    );
  });
});
