import { Logger } from '@nestjs/common';
import { NotificationJobType } from '@shared/domain/enums';
import { ERASE_PERSONAL_DATA_JOB } from '@shared/application/messaging';
import { sealJson } from '@shared/infrastructure/persistence';
import { SealedJobPayloadOpener } from '@src/infrastructure/queue/sealed-job-payload-opener';
import type { DispatchNotificationUseCase } from '@src/application/use-cases/dispatch-notification.use-case';
import type { ErasePersonalDataUseCase } from '@src/application/use-cases/erase-personal-data.use-case';
import {
  NotificationsProcessor,
  mailRatePerSecond,
} from '@src/presentation/queue/notifications.processor';

describe('mailRatePerSecond', () => {
  it('lê MAIL_RATE_PER_SECOND; inválido ou ausente vira 5', () => {
    expect(mailRatePerSecond({ MAIL_RATE_PER_SECOND: '12' })).toBe(12);
    expect(mailRatePerSecond({})).toBe(5);
    expect(mailRatePerSecond({ MAIL_RATE_PER_SECOND: '0' })).toBe(5);
    expect(mailRatePerSecond({ MAIL_RATE_PER_SECOND: 'abc' })).toBe(5);
  });
});

describe('NotificationsProcessor: falha definitiva', () => {
  const processor = new NotificationsProcessor(
    {} as never,
    {} as never,
    new SealedJobPayloadOpener(),
  );
  const logged = () => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

  it('loga ALERT só quando o job esgotou as tentativas', () => {
    const error = logged();
    const job = (attemptsMade: number) =>
      ({ id: 'j1', name: 'reminder-24h', attemptsMade, opts: { attempts: 10 } }) as never;

    processor.onFailed(job(3), new Error('SMTP fora'));
    expect(error).not.toHaveBeenCalled();

    processor.onFailed(job(10), new Error('SMTP fora'));
    expect(error).toHaveBeenCalledWith(expect.stringContaining('ALERT: job j1 (reminder-24h)'));
  });
});

describe('NotificationsProcessor', () => {
  let dispatch: { execute: jest.Mock };
  let erase: { execute: jest.Mock };
  let processor: NotificationsProcessor;

  beforeEach(() => {
    dispatch = { execute: jest.fn().mockResolvedValue(undefined) };
    erase = { execute: jest.fn().mockResolvedValue(undefined) };
    processor = new NotificationsProcessor(
      dispatch as unknown as DispatchNotificationUseCase,
      erase as unknown as ErasePersonalDataUseCase,
      new SealedJobPayloadOpener(),
    );
  });

  it('o job de exclusão de dados vai para o caso de uso de exclusão, não para o de envio', async () => {
    const job = {
      name: ERASE_PERSONAL_DATA_JOB,
      id: 'erase-u1',
      data: { userId: 'u1', donorId: 'd1' },
    } as never;
    await processor.process(job);
    expect(erase.execute).toHaveBeenCalledWith({ userId: 'u1', donorId: 'd1' });
    expect(dispatch.execute).not.toHaveBeenCalled();
  });

  it.each(Object.values(NotificationJobType))(
    'repassa um job do tipo %s ao caso de uso, com o payload e o id do job',
    async (type) => {
      const job = { name: type, id: 'job-1', data: { type, donorId: 'd1' } } as never;
      await processor.process(job);
      expect(dispatch.execute).toHaveBeenCalledWith({ type, donorId: 'd1' }, 'job-1');
    },
  );

  it('abre o corpo cifrado do job antes de repassá-lo (nome, e-mail e links não ficam em claro no Redis)', async () => {
    const payload = {
      type: NotificationJobType.REMINDER_24H,
      donorId: 'd1',
      recipientEmail: 'ana@example.com',
    };
    const job = { name: payload.type, id: 'job-2', data: sealJson(payload) } as never;
    await processor.process(job);
    expect(dispatch.execute).toHaveBeenCalledWith(payload, 'job-2');
  });

  it('ignora (sem lançar) um job de tipo desconhecido', async () => {
    const job = { name: 'TIPO_INEXISTENTE', id: 'job-x', data: {} } as never;
    await expect(processor.process(job)).resolves.toBeUndefined();
    expect(dispatch.execute).not.toHaveBeenCalled();
  });

  it('propaga a falha do caso de uso para o BullMQ aplicar retry', async () => {
    dispatch.execute.mockRejectedValue(new Error('banco fora do ar'));
    const job = {
      name: NotificationJobType.REMINDER_24H,
      id: 'job-2',
      data: { type: NotificationJobType.REMINDER_24H },
    } as never;
    await expect(processor.process(job)).rejects.toThrow('banco fora do ar');
  });
});
