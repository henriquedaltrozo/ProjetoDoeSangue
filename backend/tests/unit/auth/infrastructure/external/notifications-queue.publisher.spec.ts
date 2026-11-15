import { NotificationJobType } from '@shared/domain/enums';
import { DEFAULT_JOB_OPTIONS } from '@shared/infrastructure/messaging';
import type { Queue } from 'bullmq';
import { NotificationsQueuePublisher } from '@src/infrastructure/external/notifications-queue.publisher';

describe('NotificationsQueuePublisher (auth)', () => {
  it('enfileira a redefinição de senha com o tipo no payload', async () => {
    const queue = { add: jest.fn() };
    const notification = {
      userId: 'u1',
      recipientEmail: 'ana@example.com',
      resetUrl: 'http://front/reset?token=t',
      expiresInMinutes: 15,
    };

    await new NotificationsQueuePublisher(queue as unknown as Queue).enqueueResetPassword(
      notification,
    );

    expect(queue.add).toHaveBeenCalledWith(
      NotificationJobType.RESET_PASSWORD,
      { type: NotificationJobType.RESET_PASSWORD, ...notification },
      DEFAULT_JOB_OPTIONS,
    );
  });

  it('aviso da conta: nome do job pelo tipo e jobId fixo (repetir não duplica)', async () => {
    const queue = { add: jest.fn() };
    const payload = {
      type: NotificationJobType.EMAIL_CHANGED as const,
      userId: 'u1',
      name: 'Ana',
      recipientEmail: 'ana@example.com',
      newEmail: 'ana@novo.com',
      changedAt: '2026-11-08T15:00:00.000Z',
    };

    await new NotificationsQueuePublisher(queue as unknown as Queue).enqueueAccountNotice(
      payload,
      'account-notice-1',
    );

    expect(queue.add).toHaveBeenCalledWith(
      NotificationJobType.EMAIL_CHANGED,
      payload,
      expect.objectContaining({
        attempts: DEFAULT_JOB_OPTIONS.attempts,
        jobId: 'account-notice-1',
        // Concluídos ficam 7 dias: uma entrega repetida com o mesmo jobId é ignorada.
        removeOnComplete: { age: 7 * 24 * 3600 },
      }),
    );
  });
});
