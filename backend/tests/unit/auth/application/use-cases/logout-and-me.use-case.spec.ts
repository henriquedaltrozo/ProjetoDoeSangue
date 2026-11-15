import { NotAuthenticatedError } from '@src/application/errors/application.errors';
import { RefreshToken } from '@src/domain/entities/refresh-token';
import { Environment, createEnvironment, seedUser } from '@test/support/fakes';
import { ExistsAdminUseCase } from '@src/application/use-cases/exists-admin.use-case';
import { GetMeUseCase } from '@src/application/use-cases/get-me.use-case';
import { LogoutUseCase } from '@src/application/use-cases/logout.use-case';
import { Role } from '@shared/domain/enums';

describe('LogoutUseCase', () => {
  let env: Environment;
  let useCase: LogoutUseCase;

  beforeEach(async () => {
    env = createEnvironment();
    useCase = new LogoutUseCase(env.refreshTokens, env.tokens, env.clock);
    await env.refreshTokens.save(
      new RefreshToken({
        id: 't-1',
        userId: 'u-1',
        tokenHash: env.tokens.hash('my-token'),
        expiresAt: new Date(env.clock.now().getTime() + 1000),
        revokedAt: null,
        createdAt: env.clock.now(),
      }),
    );
  });

  it('revoga o refresh token do usuário', async () => {
    await useCase.execute('u-1', 'my-token');
    expect(env.refreshTokens.items.get('t-1')?.revokedAt).toEqual(env.clock.now());
  });

  it('não faz nada sem refresh token', async () => {
    await useCase.execute('u-1', undefined);
    expect(env.refreshTokens.items.get('t-1')?.revokedAt).toBeNull();
  });

  it('não revoga token de outro usuário', async () => {
    await useCase.execute('u-2', 'my-token');
    expect(env.refreshTokens.items.get('t-1')?.revokedAt).toBeNull();
  });
});

describe('GetMeUseCase', () => {
  it('devolve o usuário sem dados sensíveis', async () => {
    const env = createEnvironment();
    const u = await seedUser(env);
    const out = await new GetMeUseCase(env.users).execute(u.id);
    expect(out).toEqual({
      id: u.id,
      email: u.email,
      name: u.name,
      role: Role.DONOR,
      donorId: null,
      active: true,
      emailVerified: false,
      pendingEmail: null,
    });
    expect(out).not.toHaveProperty('passwordHash');
  });

  it('lança NotAuthenticatedError (Unauthorized) quando não existe', async () => {
    const env = createEnvironment();
    await expect(new GetMeUseCase(env.users).execute('nada')).rejects.toThrow(
      new NotAuthenticatedError('Unauthorized'),
    );
  });
});

describe('ExistsAdminUseCase', () => {
  it('retorna false quando não há nenhum usuário admin', async () => {
    const env = createEnvironment();
    await seedUser(env);
    await expect(new ExistsAdminUseCase(env.users).execute()).resolves.toBe(false);
  });

  it('retorna true quando já existe ao menos um usuário admin', async () => {
    const env = createEnvironment();
    await seedUser(env, { role: Role.ADMIN });
    await expect(new ExistsAdminUseCase(env.users).execute()).resolves.toBe(true);
  });
});
