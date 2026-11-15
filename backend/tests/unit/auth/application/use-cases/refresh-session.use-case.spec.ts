import { RefreshToken } from '@src/domain/entities/refresh-token';
import { NotAuthenticatedError } from '@src/application/errors/application.errors';
import { Environment, createEnvironment, seedUser } from '@test/support/fakes';
import {
  REUSE_GRACE_MS,
  RefreshSessionUseCase,
} from '@src/application/use-cases/refresh-session.use-case';

describe('RefreshSessionUseCase', () => {
  let env: Environment;
  let useCase: RefreshSessionUseCase;

  beforeEach(() => {
    env = createEnvironment();
    useCase = new RefreshSessionUseCase(
      env.users,
      env.refreshTokens,
      env.tokens,
      env.clock,
      env.sessions,
      env.logger,
      env.revocation,
    );
  });

  const seedToken = async (extra: Partial<ConstructorParameters<typeof RefreshToken>[0]> = {}) => {
    const t = new RefreshToken({
      id: 't-1',
      userId: 'u-1',
      tokenHash: env.tokens.hash('token-current'),
      expiresAt: new Date(env.clock.now().getTime() + 100_000),
      revokedAt: null,
      createdAt: env.clock.now(),
      ...extra,
    });
    await env.refreshTokens.save(t);
  };

  it('lança NotAuthenticatedError quando o token não existe', async () => {
    await expect(useCase.execute('token-invalid')).rejects.toBeInstanceOf(NotAuthenticatedError);
  });

  it('lança NotAuthenticatedError quando o token já foi revogado', async () => {
    await seedUser(env);
    await seedToken({ revokedAt: new Date() });
    await expect(useCase.execute('token-current')).rejects.toBeInstanceOf(NotAuthenticatedError);
  });

  it('lança NotAuthenticatedError quando o token expirou', async () => {
    await seedUser(env);
    await seedToken({ expiresAt: new Date(env.clock.now().getTime() - 1) });
    await expect(useCase.execute('token-current')).rejects.toBeInstanceOf(NotAuthenticatedError);
  });

  it('lança NotAuthenticatedError quando o usuário está inativo', async () => {
    await seedUser(env, { active: false });
    await seedToken();
    await expect(useCase.execute('token-current')).rejects.toThrow(
      'Refresh token inválido ou expirado.',
    );
  });

  it('rotaciona: revoga o token usado e emite um novo par', async () => {
    await seedUser(env);
    await seedToken();

    const r = await useCase.execute('token-current');

    expect(env.refreshTokens.items.get('t-1')?.revokedAt).toEqual(env.clock.now());
    expect(r.refreshToken).toBeDefined();
    expect(env.refreshTokens.items.size).toBe(2);
  });

  const seedOtherSession = () =>
    env.refreshTokens.save(
      new RefreshToken({
        id: 't-other',
        userId: 'u-1',
        tokenHash: env.tokens.hash('token-other-device'),
        expiresAt: new Date(env.clock.now().getTime() + 100_000),
        revokedAt: null,
        createdAt: env.clock.now(),
      }),
    );

  it('reuso de um token revogado há mais que a tolerância encerra todas as sessões do usuário', async () => {
    await seedUser(env);
    await seedToken({ revokedAt: new Date(env.clock.now().getTime() - REUSE_GRACE_MS - 1) });
    await seedOtherSession();

    await expect(useCase.execute('token-current')).rejects.toBeInstanceOf(NotAuthenticatedError);

    expect(env.refreshTokens.items.has('t-other')).toBe(false);
    expect(env.logger.notices[0]).toContain('Reuso de refresh token');
    // Os tokens de acesso já emitidos também deixam de valer.
    expect(env.revocation.revoked.size).toBe(1);

    // O mesmo token reapresentado depois só recebe 401: não dispara um segundo encerramento.
    await expect(useCase.execute('token-current')).rejects.toBeInstanceOf(NotAuthenticatedError);
    expect(env.logger.notices).toHaveLength(1);
  });

  it('cookie de uma sessão já encerrada (ex.: antes da troca de senha) não derruba a sessão nova', async () => {
    await seedUser(env);
    // A troca de senha apagou o token antigo; depois dela o usuário entrou de novo (t-other).
    await seedOtherSession();

    await expect(useCase.execute('token-current')).rejects.toBeInstanceOf(NotAuthenticatedError);

    expect(env.refreshTokens.items.get('t-other')?.revokedAt).toBeNull();
    expect(env.revocation.revoked.size).toBe(0);
  });

  it('token rotacionado há poucos segundos (outra aba) só recebe 401, sem derrubar as outras sessões', async () => {
    await seedUser(env);
    await seedToken({ revokedAt: new Date(env.clock.now().getTime() - 2_000) });
    await seedOtherSession();

    await expect(useCase.execute('token-current')).rejects.toBeInstanceOf(NotAuthenticatedError);

    expect(env.refreshTokens.items.get('t-other')?.revokedAt).toBeNull();
  });

  it('duas renovações simultâneas com o mesmo token: só uma emite sessão', async () => {
    await seedUser(env);
    await seedToken();

    const results = await Promise.allSettled([
      useCase.execute('token-current'),
      useCase.execute('token-current'),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(env.refreshTokens.items.size).toBe(2);
  });
});
