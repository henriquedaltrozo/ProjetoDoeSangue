import { NotificationJobType } from '@shared/domain/enums';
import { DEFAULT_JOB_OPTIONS } from '@shared/infrastructure/messaging';
import { isSealed, openJson } from '@shared/infrastructure/persistence';
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
      expect.objectContaining({ sealed: expect.stringMatching(/^gcm:/) }),
      DEFAULT_JOB_OPTIONS,
    );
    // O Redis não vê o e-mail nem o link com o token: só o conteúdo cifrado.
    const data = queue.add.mock.calls[0][1];
    expect(isSealed(data)).toBe(true);
    expect(JSON.stringify(data)).not.toContain('ana@example.com');
    expect(JSON.stringify(data)).not.toContain('token=t');
    expect(openJson(data)).toEqual({ type: NotificationJobType.RESET_PASSWORD, ...notification });
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

    expect(openJson(queue.add.mock.calls[0][1])).toEqual(payload);
    expect(queue.add).toHaveBeenCalledWith(
      NotificationJobType.EMAIL_CHANGED,
      expect.objectContaining({ sealed: expect.any(String) }),
      expect.objectContaining({
        attempts: DEFAULT_JOB_OPTIONS.attempts,
        jobId: 'account-notice-1',
        // Concluídos ficam 7 dias: uma entrega repetida com o mesmo jobId é ignorada.
        removeOnComplete: { age: 7 * 24 * 3600 },
      }),
    );
  });
});
