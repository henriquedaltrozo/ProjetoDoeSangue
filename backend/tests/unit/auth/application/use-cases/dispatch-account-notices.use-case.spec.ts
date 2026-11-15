import { NotificationJobType } from '@shared/domain/enums';
import {
  ACCOUNT_NOTICE_MAX_AGE_MS,
  DispatchAccountNoticesUseCase,
} from '@src/application/use-cases/dispatch-account-notices.use-case';
import { type Environment, createEnvironment } from '@test/support/fakes';

describe('DispatchAccountNoticesUseCase', () => {
  let env: Environment;
  let useCase: DispatchAccountNoticesUseCase;
  const notice = {
    type: NotificationJobType.PASSWORD_CHANGED as const,
    userId: 'u-1',
    name: 'Ana',
    recipientEmail: 'ana@example.com',
    changedAt: '2026-11-08T15:00:00.000Z',
  };

  beforeEach(() => {
    env = createEnvironment();
    useCase = new DispatchAccountNoticesUseCase(
      env.accountNotices,
      env.notifications,
      env.clock,
      env.logger,
    );
  });

  it('entrega à fila com jobId fixo por aviso e apaga o registro', async () => {
    await env.accountNotices.add(notice);

    expect(await useCase.execute()).toBe(1);

    expect(env.notifications.accountNotices).toEqual([
      { payload: notice, jobId: 'account-notice-notice-1' },
    ]);
    expect(env.accountNotices.items.size).toBe(0);
  });

  it('com a fila fora do ar, guarda o aviso e reagenda com espera crescente', async () => {
    await env.accountNotices.add(notice);
    env.notifications.failure = new Error('Redis fora');

    await useCase.execute();

    const stored = env.accountNotices.items.get('notice-1');
    expect(stored?.attempts).toBe(1);
    expect(stored?.lastError).toBe('Redis fora');
    expect(stored?.nextAttemptAt.getTime()).toBe(env.clock.now().getTime() + 5_000);

    // Quando a fila volta, o aviso sai.
    env.notifications.failure = null;
    if (stored) stored.nextAttemptAt = env.clock.now();
    await useCase.execute();
    expect(env.notifications.accountNotices).toHaveLength(1);
    expect(env.accountNotices.items.size).toBe(0);
  });

  it('aviso com mais de 24 h ainda sem entrega é descartado com um log ALERT', async () => {
    await env.accountNotices.add(notice);
    const stored = env.accountNotices.items.get('notice-1');
    if (stored)
      stored.createdAt = new Date(env.clock.now().getTime() - ACCOUNT_NOTICE_MAX_AGE_MS - 1);
    env.notifications.failure = new Error('Redis fora');

    await useCase.execute();

    expect(env.accountNotices.items.size).toBe(0);
    expect(env.logger.errors[0]).toContain('ALERT');
  });
});
