import { NotificationJobType } from '@shared/domain/enums';
import { PasswordResetToken } from '@src/domain/entities/password-reset-token';
import { RefreshToken } from '@src/domain/entities/refresh-token';
import { NotAuthenticatedError } from '@src/application/errors/application.errors';
import { Environment, createEnvironment, seedUser } from '@test/support/fakes';
import { ResetPasswordUseCase } from '@src/application/use-cases/reset-password.use-case';

describe('ResetPasswordUseCase', () => {
  let env: Environment;
  let useCase: ResetPasswordUseCase;
  const input = { token: 'valid', newPassword: 'new12345' };

  beforeEach(() => {
    env = createEnvironment();
    useCase = new ResetPasswordUseCase(
      env.unitOfWork,
      env.hasher,
      env.tokens,
      env.revocation,
      env.clock,
    );
  });

  const seedReset = (extra: Partial<ConstructorParameters<typeof PasswordResetToken>[0]> = {}) =>
    env.resetTokens.save(
      new PasswordResetToken({
        id: 'r-1',
        userId: 'u-1',
        tokenHash: env.tokens.hash('valid'),
        expiresAt: new Date(env.clock.now().getTime() + 100_000),
        usedAt: null,
        createdAt: env.clock.now(),
        ...extra,
      }),
    );

  it('grava o aviso de senha alterada no outbox, na mesma transação da troca', async () => {
    const user = await seedUser(env);
    await seedReset();

    await useCase.execute({ token: 'valid', newPassword: 'new12345' });

    expect(env.accountNotices.payloads()).toEqual([
      {
        type: NotificationJobType.PASSWORD_CHANGED,
        userId: user.id,
        name: user.name,
        recipientEmail: user.email,
        changedAt: env.clock.now().toISOString(),
      },
    ]);
  });

  it('token inválido: nenhum aviso é gravado', async () => {
    await seedUser(env);

    await expect(useCase.execute({ token: 'invalid', newPassword: 'x' })).rejects.toThrow();

    expect(env.accountNotices.items.size).toBe(0);
  });

  it('lança NotAuthenticatedError quando o token não existe', async () => {
    await expect(useCase.execute({ token: 'invalid', newPassword: 'x' })).rejects.toBeInstanceOf(
      NotAuthenticatedError,
    );
  });

  it('lança NotAuthenticatedError quando o token já foi usado', async () => {
    await seedUser(env);
    await seedReset({ usedAt: new Date() });
    await expect(useCase.execute(input)).rejects.toBeInstanceOf(NotAuthenticatedError);
  });

  it('lança NotAuthenticatedError quando o token expirou', async () => {
    await seedUser(env);
    await seedReset({ expiresAt: new Date(env.clock.now().getTime() - 1000) });
    await expect(useCase.execute(input)).rejects.toThrow(
      'Token de redefinição inválido ou expirado.',
    );
  });

  it('lança NotAuthenticatedError quando o usuário do token não existe mais', async () => {
    await seedReset();
    await expect(useCase.execute(input)).rejects.toBeInstanceOf(NotAuthenticatedError);
  });

  it('atualiza a senha, limpa o bloqueio, marca o token como usado e encerra as sessões', async () => {
    await seedUser(env, { loginFailures: 3, blockedUntil: new Date(2999, 1, 1) });
    await seedReset();
    await env.refreshTokens.save(
      new RefreshToken({
        id: 't-1',
        userId: 'u-1',
        tokenHash: 'h',
        expiresAt: new Date(2999, 1, 1),
        revokedAt: null,
        createdAt: env.clock.now(),
      }),
    );

    await useCase.execute(input);

    const u = await env.users.findById('u-1');
    expect(u?.passwordHash).toBe('hash:new12345');
    expect(u?.loginFailures).toBe(0);
    expect(u?.blockedUntil).toBeNull();
    expect(env.resetTokens.items.get('r-1')?.usedAt).toEqual(env.clock.now());
    expect(env.refreshTokens.items.has('t-1')).toBe(false);
  });

  it('o token só vale uma vez, mesmo com duas redefinições simultâneas', async () => {
    await seedUser(env);
    await seedReset();

    const results = await Promise.allSettled([
      useCase.execute(input),
      useCase.execute({ ...input, newPassword: 'outra-senha-1' }),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });
});
