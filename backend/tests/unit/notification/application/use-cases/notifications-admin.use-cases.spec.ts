import { Logger } from '@nestjs/common';
import { NotificationJobType } from '@shared/domain/enums';
import { NotFoundError } from '@src/application/errors';
import {
  ListFailedJobsUseCase,
  ListSentNotificationsUseCase,
  RemoveSuppressedUseCase,
  RetryFailedJobUseCase,
  SENT_PAGE_SIZE,
} from '@src/application/use-cases/notifications-admin.use-cases';
import { RegisterMailEventsUseCase } from '@src/application/use-cases/register-mail-events.use-case';
import { NotificationLog } from '@src/domain/entities/notification-log';
import { NotificationStatus } from '@src/domain/enums';
import {
  MailEventsWebhookController,
  parseEvents,
} from '@src/presentation/http/mail-events-webhook.controller';

describe('acompanhamento dos e-mails (admin)', () => {
  it('lista os envios com destinatário e erro mascarados', async () => {
    const log = NotificationLog.byEmail({
      type: NotificationJobType.REMINDER_24H,
      recipient: 'fulano@example.com',
      subject: 'Lembrete',
      message: 'x',
      jobId: 'j1',
    });
    log.markFailure('550 fulano@example.com: mailbox unavailable');
    const logs = { listPage: jest.fn().mockResolvedValue({ items: [log], total: 1 }) };

    const page = await new ListSentNotificationsUseCase(logs as never).execute(
      2,
      NotificationStatus.FAILURE,
    );

    expect(logs.listPage).toHaveBeenCalledWith(2, SENT_PAGE_SIZE, NotificationStatus.FAILURE);
    expect(page.items[0]).toMatchObject({
      recipient: 'fu***@example.com',
      error: '550 fu***@example.com: mailbox unavailable',
      status: NotificationStatus.FAILURE,
    });
    expect(page).toMatchObject({ total: 1, page: 2, pageSize: SENT_PAGE_SIZE });
  });

  it('lista as falhas definitivas com o motivo mascarado e reenvia', async () => {
    const jobs = {
      list: jest.fn().mockResolvedValue([
        {
          id: '7',
          type: 'reminder-24h',
          failedReason: 'x <a@b.com>',
          attemptsMade: 10,
          failedAt: null,
        },
      ]),
      retry: jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false),
    };

    expect((await new ListFailedJobsUseCase(jobs).execute())[0].failedReason).toBe(
      'x <a***@b.com>',
    );
    await new RetryFailedJobUseCase(jobs).execute('7');
    await expect(new RetryFailedJobUseCase(jobs).execute('8')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('desbloquear um endereço que não está bloqueado é 404', async () => {
    const suppression = { remove: jest.fn().mockResolvedValue(false) };

    await expect(
      new RemoveSuppressedUseCase(suppression as never).execute('x@y.com'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('eventos do provedor (devoluções e spam)', () => {
  const logger = { warn: jest.fn(), error: jest.fn() };

  it('bloqueia só os eventos graves', async () => {
    const suppression = { add: jest.fn() };

    const count = await new RegisterMailEventsUseCase(suppression as never, logger).execute([
      { event: 'hard_bounce', email: 'a@x.com' },
      { event: 'spam', email: 'b@x.com' },
      { event: 'soft_bounce', email: 'c@x.com' },
      { event: 'delivered', email: 'd@x.com' },
    ]);

    expect(count).toBe(2);
    expect(suppression.add.mock.calls).toEqual([
      ['a@x.com', 'hard_bounce'],
      ['b@x.com', 'spam'],
    ]);
  });

  it('aceita um evento ou uma lista e ignora o que não tem event e email', () => {
    expect(parseEvents({ event: 'spam', email: 'a@x.com', id: 1 })).toEqual([
      { event: 'spam', email: 'a@x.com' },
    ]);
    expect(parseEvents([{ event: 'spam' }, null, 'x'])).toEqual([]);
  });

  describe('webhook', () => {
    const register = { execute: jest.fn().mockResolvedValue(1) };
    const controller = (secret?: string) =>
      new MailEventsWebhookController(register as never, { get: () => secret } as never);
    beforeEach(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined));

    it('sem segredo configurado, a rota não existe (404)', async () => {
      await expect(controller().mail('x', {})).rejects.toMatchObject({ status: 404 });
    });

    it('token errado: 403; certo: registra os eventos', async () => {
      await expect(controller('s3cr3t').mail('errado', {})).rejects.toMatchObject({ status: 403 });
      await expect(
        controller('s3cr3t').mail('s3cr3t', { event: 'spam', email: 'a@x.com' }),
      ).resolves.toEqual({ suppressed: 1 });
    });
  });
});
