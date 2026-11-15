import { Role } from '@shared/domain/enums';
import { PasswordResetToken } from '@src/domain/entities/password-reset-token';
import { RefreshToken } from '@src/domain/entities/refresh-token';
import {
  NotAuthenticatedError,
  AccessDeniedError,
  InvalidEntryError,
} from '@src/application/errors/application.errors';
import { Environment, createEnvironment, seedUser } from '@test/support/fakes';
import { DeleteMyAccountUseCase } from '@src/application/use-cases/delete-my-account.use-case';

describe('DeleteMyAccountUseCase', () => {
  let env: Environment;
  let useCase: DeleteMyAccountUseCase;

  beforeEach(() => {
    env = createEnvironment();
    useCase = new DeleteMyAccountUseCase(
      env.users,
      env.unitOfWork,
      env.hasher,
      env.tokens,
      env.eligibility,
      env.scheduling,
      env.notifications,
      env.revocation,
      env.clock,
    );
  });

  it('lança NotAuthenticatedError quando o usuário não existe', async () => {
    await expect(useCase.execute('not-exists', 'password-correct')).rejects.toBeInstanceOf(
      NotAuthenticatedError,
    );
  });

  it('exige a senha atual: com a senha errada, nada é excluído', async () => {
    const u = await seedUser(env, { donorId: 'donor-1' });

    await expect(useCase.execute(u.id, 'senha-errada')).rejects.toBeInstanceOf(InvalidEntryError);

    expect(env.scheduling.canceledFor).toHaveLength(0);
    expect(env.eligibility.anonymized).toHaveLength(0);
    expect((await env.users.findById(u.id))?.active).toBe(true);
  });

  it('lança AccessDeniedError para contas admin', async () => {
    const admin = await seedUser(env, { role: Role.ADMIN });
    await expect(useCase.execute(admin.id, 'password-correct')).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
    expect(env.eligibility.anonymized).toHaveLength(0);
  });

  it('anonimiza o doador no eligibility-service, o usuario aqui, e encerra as sessões', async () => {
    const u = await seedUser(env, { donorId: 'donor-1' });
    await env.refreshTokens.save(
      new RefreshToken({
        id: 't-1',
        userId: u.id,
        tokenHash: 'h',
        expiresAt: new Date(2999, 1, 1),
        revokedAt: null,
        createdAt: env.clock.now(),
      }),
    );
    await env.resetTokens.save(
      new PasswordResetToken({
        id: 'r-1',
        userId: u.id,
        tokenHash: 'h2',
        expiresAt: new Date(2999, 1, 1),
        usedAt: null,
        createdAt: env.clock.now(),
      }),
    );

    await useCase.execute(u.id, 'password-correct');

    expect(env.scheduling.canceledFor).toEqual(['donor-1']);
    expect(env.eligibility.anonymized).toEqual(['donor-1']);
    expect(env.notifications.erasures).toEqual([{ userId: u.id, donorId: 'donor-1' }]);
    expect(env.revocation.revoked.has(u.id)).toBe(true);
    const saved = await env.users.findById(u.id);
    expect(saved).toMatchObject({
      name: 'Usuário anonimizado',
      email: `anon-${u.id}@anonymized.local`,
      active: false,
    });
    expect(saved?.passwordHash).not.toBe(u.passwordHash);
    expect(env.refreshTokens.items.has('t-1')).toBe(false);
    expect(env.resetTokens.items.get('r-1')?.usedAt).toEqual(env.clock.now());
  });

  it('não chama o eligibility-service quando o usuario não tem donorId associado', async () => {
    const u = await seedUser(env, { donorId: null });

    await useCase.execute(u.id, 'password-correct');

    expect(env.eligibility.anonymized).toHaveLength(0);
    expect(env.scheduling.canceledFor).toHaveLength(0);
    expect((await env.users.findById(u.id))?.active).toBe(false);
  });

  it('se cancelar os agendamentos falhar, nada mais é feito e o pedido pode ser repetido', async () => {
    const u = await seedUser(env, { donorId: 'donor-1' });
    env.scheduling.failure = new Error('scheduling fora do ar');

    await expect(useCase.execute(u.id, 'password-correct')).rejects.toThrow(
      'scheduling fora do ar',
    );
    expect(env.eligibility.anonymized).toHaveLength(0);
    expect((await env.users.findById(u.id))?.active).toBe(true);
  });

  it('se a parte local falhar, o eligibility já foi anonimizado e repetir o pedido funciona', async () => {
    const u = await seedUser(env, { donorId: 'donor-1' });
    const original = env.users.save.bind(env.users);
    env.users.save = async () => {
      throw new Error('banco indisponível');
    };

    await expect(useCase.execute(u.id, 'password-correct')).rejects.toThrow('banco indisponível');
    expect((await env.users.findById(u.id))?.active).toBe(true);

    env.users.save = original;
    await useCase.execute(u.id, 'password-correct');

    expect(env.eligibility.anonymized).toEqual(['donor-1', 'donor-1']);
    expect((await env.users.findById(u.id))?.active).toBe(false);
  });
});
