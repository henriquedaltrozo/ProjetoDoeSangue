import { Role } from '@shared/domain/enums';
import {
  ManyAttemptsError,
  NotAuthenticatedError,
} from '@src/application/errors/application.errors';
import { Environment, createEnvironment, seedUser } from '@test/support/fakes';
import { LoginUseCase } from '@src/application/use-cases/login.use-case';

describe('LoginUseCase', () => {
  let env: Environment;
  let useCase: LoginUseCase;
  const correctPassword = 'password-correct';

  beforeEach(() => {
    env = createEnvironment();
    useCase = new LoginUseCase(env.users, env.hasher, env.clock, env.logger, env.sessions);
  });

  it('lança NotAuthenticatedError quando o usuário não existe', async () => {
    await expect(useCase.execute({ email: 'x@x.com', password: 'errada123' })).rejects.toThrow(
      new NotAuthenticatedError('Credenciais inválidas.'),
    );
  });

  it('lança NotAuthenticatedError quando a senha está incorreta', async () => {
    const u = await seedUser(env);
    await expect(
      useCase.execute({ email: u.email, password: 'password-wrong' }),
    ).rejects.toBeInstanceOf(NotAuthenticatedError);
  });

  it('o e-mail não diferencia maiúsculas nem espaços nas pontas', async () => {
    const u = await seedUser(env);
    const result = await useCase.execute({
      email: `  ${u.email.toUpperCase()} `,
      password: correctPassword,
    });
    expect(result.user.id).toBe(u.id);
  });

  it('recusa conta inativa mesmo com a senha certa', async () => {
    const u = await seedUser(env, { active: false });
    await expect(
      useCase.execute({ email: u.email, password: correctPassword }),
    ).rejects.toBeInstanceOf(NotAuthenticatedError);
  });

  describe('bloqueio por força bruta', () => {
    it('conta a falha ao errar a senha', async () => {
      const u = await seedUser(env);
      await expect(useCase.execute({ email: u.email, password: 'errada' })).rejects.toBeInstanceOf(
        NotAuthenticatedError,
      );
      expect((await env.users.findById(u.id))?.loginFailures).toBe(1);
    });

    it('bloqueia a conta na quinta falha seguida e registra um aviso', async () => {
      const u = await seedUser(env, { loginFailures: 4 });
      await expect(useCase.execute({ email: u.email, password: 'errada' })).rejects.toBeInstanceOf(
        NotAuthenticatedError,
      );
      const saved = await env.users.findById(u.id);
      expect(saved?.blockedUntil?.getTime()).toBe(env.clock.now().getTime() + 15 * 60_000);
      expect(saved?.loginFailures).toBe(0);
      expect(env.logger.notices).toHaveLength(1);
    });

    it('recusa com ManyAttemptsError enquanto a conta está bloqueada, mesmo com a senha certa', async () => {
      const u = await seedUser(env, {
        blockedUntil: new Date(env.clock.now().getTime() + 60_000),
      });
      await expect(
        useCase.execute({ email: u.email, password: correctPassword }),
      ).rejects.toBeInstanceOf(ManyAttemptsError);
    });

    it('volta a aceitar o login depois que o bloqueio expira', async () => {
      const u = await seedUser(env, {
        blockedUntil: new Date(env.clock.now().getTime() + 60_000),
      });
      env.clock.advance(61_000);
      const r = await useCase.execute({ email: u.email, password: correctPassword });
      expect(r.accessToken).toBe('access-token');
    });

    it('não desfaz uma desativação nem uma troca de senha feitas enquanto conferia a senha', async () => {
      const u = await seedUser(env);
      const verify = env.hasher.verify.bind(env.hasher);
      env.hasher.verify = async (password, hash) => {
        // Gravação concorrente: um admin desativa a conta e a senha é trocada no meio do login.
        const stored = env.users.items.get(u.id);
        if (stored) Object.assign(stored, { active: false, passwordHash: 'hash:outra' });
        return verify(password, hash);
      };

      await useCase.execute({ email: u.email, password: correctPassword });

      const saved = await env.users.findById(u.id);
      expect(saved?.active).toBe(false);
      expect(saved?.passwordHash).toBe('hash:outra');
      expect(saved?.lastLoginAt).toEqual(env.clock.now());
    });

    it('zera o contador no login bem-sucedido e emite os tokens', async () => {
      const u = await seedUser(env, { loginFailures: 3 });

      const r = await useCase.execute({ email: u.email, password: correctPassword });

      const saved = await env.users.findById(u.id);
      expect(saved?.loginFailures).toBe(0);
      expect(saved?.lastLoginAt).toEqual(env.clock.now());
      expect(r.refreshToken).toBeDefined();
      expect(r.refreshExpiresAt.getTime()).toBe(env.clock.now().getTime() + 7 * 86_400_000);
      expect(env.accessTokens.issued[0]).toEqual({
        sub: u.id,
        email: u.email,
        role: Role.DONOR,
        donorId: null,
        // O doador só agenda depois de confirmar o e-mail (ver o claim no scheduling).
        emailVerified: false,
      });
    });
  });
});
