import { NotificationJobType } from '@shared/domain/enums';
import {
  ConflictError,
  DependencyUnavailableError,
  InvalidEntryError,
} from '@src/application/errors/application.errors';
import { ResendEmailVerificationUseCase } from '@src/application/use-cases/resend-email-verification.use-case';
import { VerifyEmailUseCase } from '@src/application/use-cases/verify-email.use-case';
import { type Environment, createEnvironment, seedUser } from '@test/support/fakes';

describe('confirmação de e-mail', () => {
  let env: Environment;
  let verify: VerifyEmailUseCase;
  let resend: ResendEmailVerificationUseCase;
  const future = () => new Date(env.clock.now().getTime() + 3_600_000);
  const tokenFor = (userId: string, email: string, expiresAt = future()) =>
    env.emailTokens.generate({ userId, email }, expiresAt);

  beforeEach(() => {
    env = createEnvironment();
    verify = new VerifyEmailUseCase(
      env.emailTokens,
      env.users,
      env.unitOfWork,
      env.eligibility,
      env.clock,
    );
    resend = new ResendEmailVerificationUseCase(env.users, env.unitOfWork, env.verificationNotices);
  });

  describe('VerifyEmailUseCase', () => {
    it('confirma o e-mail atual, aqui e no doador; repetir não dá erro', async () => {
      const user = await seedUser(env, { donorId: 'donor-1', emailVerifiedAt: null });

      const out = await verify.execute(tokenFor(user.id, user.email));

      expect(out).toEqual({ email: user.email, changed: false });
      expect((await env.users.findById(user.id))?.emailVerifiedAt).toEqual(env.clock.now());
      expect(env.eligibility.identityUpdates).toEqual([
        { donorId: 'donor-1', data: { emailVerified: true } },
      ]);

      await expect(verify.execute(tokenFor(user.id, user.email))).resolves.toMatchObject({
        changed: false,
      });
      expect(env.eligibility.identityUpdates).toHaveLength(1);
    });

    it('link do e-mail pendente: conclui a troca, atualiza o doador e avisa o endereço antigo', async () => {
      const user = await seedUser(env, {
        donorId: 'donor-1',
        emailVerifiedAt: new Date(),
        pendingEmail: 'nova@example.com',
      });

      const out = await verify.execute(tokenFor(user.id, 'nova@example.com'));

      expect(out).toEqual({ email: 'nova@example.com', changed: true });
      const saved = await env.users.findById(user.id);
      expect(saved).toMatchObject({ email: 'nova@example.com', pendingEmail: null });
      expect(env.eligibility.identityUpdates).toEqual([
        { donorId: 'donor-1', data: { email: 'nova@example.com', emailVerified: true } },
      ]);
      expect(env.accountNotices.payloads()).toEqual([
        {
          type: NotificationJobType.EMAIL_CHANGED,
          userId: user.id,
          name: user.name,
          recipientEmail: user.email,
          newEmail: 'nova@example.com',
          changedAt: env.clock.now().toISOString(),
        },
      ]);
    });

    it('troca recusada se outra conta tomou o e-mail novo nesse meio-tempo', async () => {
      await seedUser(env, { email: 'nova@example.com' });
      const user = await seedUser(env, {
        email: 'eu@example.com',
        pendingEmail: 'nova@example.com',
      });

      await expect(verify.execute(tokenFor(user.id, 'nova@example.com'))).rejects.toBeInstanceOf(
        ConflictError,
      );
    });

    it('se o eligibility falhar, a troca não acontece (pode tentar o link de novo)', async () => {
      const user = await seedUser(env, { donorId: 'donor-1', pendingEmail: 'nova@example.com' });
      env.eligibility.identityFailure = new DependencyUnavailableError('fora do ar');

      await expect(verify.execute(tokenFor(user.id, 'nova@example.com'))).rejects.toBeInstanceOf(
        DependencyUnavailableError,
      );
      expect((await env.users.findById(user.id))?.email).toBe(user.email);
    });

    it('recusa token inválido, expirado ou de um e-mail que já não é o da conta', async () => {
      const user = await seedUser(env, { emailVerifiedAt: null });

      await expect(verify.execute('lixo')).rejects.toBeInstanceOf(InvalidEntryError);
      await expect(
        verify.execute(tokenFor(user.id, user.email, new Date(env.clock.now().getTime() - 1))),
      ).rejects.toThrow(/expirou/);
      await expect(verify.execute(tokenFor(user.id, 'antigo@example.com'))).rejects.toThrow(
        /não vale mais/,
      );
      await expect(verify.execute(tokenFor('nao-existe', user.email))).rejects.toBeInstanceOf(
        InvalidEntryError,
      );
    });
  });

  describe('ResendEmailVerificationUseCase', () => {
    it('reenvia para o e-mail novo, se há troca pendente', async () => {
      const user = await seedUser(env, { pendingEmail: 'nova@example.com' });

      expect(await resend.execute(user.id)).toEqual({ sentTo: 'nova@example.com' });
      expect(env.accountNotices.payloads()).toEqual([
        expect.objectContaining({ recipientEmail: 'nova@example.com', purpose: 'change' }),
      ]);
    });

    it('reenvia para o e-mail atual não confirmado; confirmado e sem troca, não envia nada', async () => {
      const pending = await seedUser(env, { emailVerifiedAt: null });
      const done = await seedUser(env, { email: 'ok@example.com', emailVerifiedAt: new Date() });

      expect(await resend.execute(pending.id)).toEqual({ sentTo: pending.email });
      expect(await resend.execute(done.id)).toEqual({ sentTo: null });
      expect(env.accountNotices.payloads()).toEqual([
        expect.objectContaining({ recipientEmail: pending.email, purpose: 'signup' }),
      ]);
    });
  });
});
