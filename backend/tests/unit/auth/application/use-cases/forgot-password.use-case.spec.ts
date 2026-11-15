import { Environment, createEnvironment, seedUser } from '@test/support/fakes';
import { ForgotPasswordUseCase } from '@src/application/use-cases/forgot-password.use-case';

describe('ForgotPasswordUseCase', () => {
  let env: Environment;
  let useCase: ForgotPasswordUseCase;
  const MESSAGE = 'Se este e-mail estiver cadastrado, um link de redefinição foi gerado.';

  beforeEach(() => {
    env = createEnvironment();
    useCase = new ForgotPasswordUseCase(
      env.users,
      env.resetTokens,
      env.tokens,
      env.notifications,
      env.settings,
      env.clock,
      env.ids,
      env.logger,
    );
  });

  it('gera e devolve um token quando o e-mail existe, está ativo, e SMTP não está configurado', async () => {
    await seedUser(env);

    const r = await useCase.execute({ email: 'donor@example.com' });

    expect(r.resetToken).toBeDefined();
    const [saved] = [...env.resetTokens.items.values()];
    expect(saved.tokenHash).toBe(env.tokens.hash(r.resetToken as string));
    expect(saved.expiresAt.getTime()).toBe(env.clock.now().getTime() + 15 * 60_000);
  });

  it('um pedido novo invalida os links anteriores ainda não usados', async () => {
    await seedUser(env);

    const first = await useCase.execute({ email: 'donor@example.com' });
    const second = await useCase.execute({ email: 'donor@example.com' });

    const byHash = (token: string | undefined) =>
      [...env.resetTokens.items.values()].find(
        (t) => t.tokenHash === env.tokens.hash(token as string),
      );
    expect(byHash(first.resetToken)?.isValid(env.clock.now())).toBe(false);
    expect(byHash(second.resetToken)?.isValid(env.clock.now())).toBe(true);
  });

  it('sempre enfileira o e-mail de redefinição quando a conta existe e está ativa', async () => {
    const u = await seedUser(env);

    const r = await useCase.execute({ email: u.email });

    expect(env.notifications.sent).toEqual([
      {
        userId: u.id,
        recipientEmail: u.email,
        resetUrl: `http://localhost:5173/password-reset?token=${r.resetToken}`,
        expiresInMinutes: 15,
      },
    ]);
  });

  it('omite resetToken da resposta quando SMTP está configurado, mas ainda enfileira o e-mail', async () => {
    env.settings.smtpConfigured = true;
    await seedUser(env);

    const r = await useCase.execute({ email: 'donor@example.com' });

    expect(r.resetToken).toBeUndefined();
    expect(r.message).toBe(MESSAGE);
    expect(env.notifications.sent).toHaveLength(1);
  });

  it('em produção sem SMTP, nunca devolve o token na resposta: o link vai só para o log', async () => {
    env.settings.production = true;
    const user = await seedUser(env);

    const r = await useCase.execute({ email: 'donor@example.com' });

    expect(r.resetToken).toBeUndefined();
    expect(r.message).toBe(MESSAGE);
    // O token continua sendo gerado e o e-mail enfileirado; quem opera o servidor acha o link no log.
    expect(env.resetTokens.items.size).toBe(1);
    expect(env.notifications.sent).toHaveLength(1);
    expect(env.logger.notices[0]).toContain(user.id);
    expect(env.logger.notices[0]).toContain('/password-reset?token=');
  });

  it('não impede a geração do token quando o enfileiramento falha (best-effort)', async () => {
    env.notifications.failure = new Error('redis indisponível');
    await seedUser(env);

    const r = await useCase.execute({ email: 'donor@example.com' });

    expect(r.resetToken).toBeDefined();
    expect(env.resetTokens.items.size).toBe(1);
    expect(env.logger.errors[0]).toContain('redis indisponível');
  });

  it('não gera token e devolve a mesma mensagem genérica quando o e-mail não existe', async () => {
    const r = await useCase.execute({ email: 'not-exists@example.com' });

    expect(r).toEqual({ message: MESSAGE });
    expect(env.resetTokens.items.size).toBe(0);
    expect(env.notifications.sent).toHaveLength(0);
  });

  it('não gera token quando a conta existe mas está inativa', async () => {
    await seedUser(env, { active: false });

    const r = await useCase.execute({ email: 'donor@example.com' });

    expect(r.resetToken).toBeUndefined();
    expect(env.resetTokens.items.size).toBe(0);
    expect(env.notifications.sent).toHaveLength(0);
  });
});
