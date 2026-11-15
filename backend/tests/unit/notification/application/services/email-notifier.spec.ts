import { NotificationJobType } from '@shared/domain/enums';
import { NotificationChannel, NotificationStatus } from '@src/domain/enums';
import { NotificationLog } from '@src/domain/entities/notification-log';
import { EmailNotifier } from '@src/application/services/email-notifier';

describe('EmailNotifier', () => {
  let mail: { send: jest.Mock };
  let saved: NotificationLog[];
  let logs: {
    save: jest.Mock;
    wasSent: jest.Mock;
    erasePersonalData: jest.Mock;
    purgeOlderThan: jest.Mock;
    listPage: jest.Mock;
    isErased: jest.Mock;
  };
  let logger: { warn: jest.Mock; error: jest.Mock };
  let notifier: EmailNotifier;
  let suppression: Record<'reasonFor' | 'add' | 'remove' | 'list', jest.Mock>;

  const data = {
    donorId: 'donor-1',
    type: NotificationJobType.REMINDER_24H,
    recipient: 'fulano@example.com',
    subject: 'Assunto',
    message: 'Mensagem',
    jobId: 'job-1',
  };

  beforeEach(() => {
    saved = [];
    mail = { send: jest.fn().mockResolvedValue(undefined) };
    logs = {
      save: jest.fn(async (l: NotificationLog) => void saved.push(l)),
      wasSent: jest.fn().mockResolvedValue(false),
      erasePersonalData: jest.fn(),
      purgeOlderThan: jest.fn(),
      listPage: jest.fn(),
      isErased: jest.fn().mockResolvedValue(false),
    };
    logger = { warn: jest.fn(), error: jest.fn() };
    suppression = {
      reasonFor: jest.fn().mockResolvedValue(null),
      add: jest.fn(),
      remove: jest.fn(),
      list: jest.fn(),
    };
    notifier = new EmailNotifier(mail, logs, logger, suppression);
  });

  it('envia o e-mail e grava um log SENT por e-mail', async () => {
    await expect(notifier.send(data)).resolves.toBe(true);

    expect(mail.send).toHaveBeenCalledWith({
      to: 'fulano@example.com',
      subject: 'Assunto',
      text: 'Mensagem',
    });
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      donorId: 'donor-1',
      userId: null,
      channel: NotificationChannel.EMAIL,
      status: NotificationStatus.SENT,
      error: null,
      jobId: 'job-1',
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('não envia nem grava o e-mail de quem já excluiu a conta (estava na fila antes)', async () => {
    logs.isErased.mockResolvedValue(true);

    await expect(notifier.send(data)).resolves.toBe(true);

    expect(logs.isErased).toHaveBeenCalledWith('donor-1', null);
    expect(mail.send).not.toHaveBeenCalled();
    expect(saved).toHaveLength(0);
  });

  it('mascara o e-mail no log de falha (dado pessoal)', async () => {
    mail.send.mockRejectedValue(new Error('SMTP fora do ar'));

    await notifier.send(data);

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('fu***@example.com'));
    expect(logger.error).not.toHaveBeenCalledWith(expect.stringContaining('fulano@example.com'));
  });

  it('endereço bloqueado (devolveu ou marcou spam): não envia, registra SUPPRESSED e não pede nova tentativa', async () => {
    suppression.reasonFor.mockResolvedValue('hard_bounce');

    await expect(notifier.send(data)).resolves.toBe(true);

    expect(mail.send).not.toHaveBeenCalled();
    expect(saved[0].status).toBe(NotificationStatus.SUPPRESSED);
    expect(saved[0].error).toBe('Endereço bloqueado: hard_bounce');
  });

  it('o registro não guarda o token de nenhum link (o e-mail enviado guarda)', async () => {
    await notifier.send({
      ...data,
      message: 'Confirme: http://front/confirm-attendance?token=segredo.assinado',
    });

    expect(mail.send.mock.calls[0][0].text).toContain('token=segredo.assinado');
    expect(saved[0].message).toBe('Confirme: http://front/confirm-attendance?token=[omitido]');
  });

  it('não reenvia se este job já entregou a este destinatário numa tentativa anterior', async () => {
    logs.wasSent.mockResolvedValue(true);

    await expect(notifier.send(data)).resolves.toBe(true);

    expect(logs.wasSent).toHaveBeenCalledWith('job-1', 'fulano@example.com');
    expect(mail.send).not.toHaveBeenCalled();
    expect(saved).toHaveLength(0);
  });

  it('o motivo da falha vai ao log com os e-mails mascarados (o registro guarda o original)', async () => {
    mail.send.mockRejectedValueOnce(new Error('550 <fulano@example.com>: mailbox unavailable'));

    await notifier.send(data);

    expect(saved[0].error).toBe('550 <fulano@example.com>: mailbox unavailable');
    expect(logger.error).toHaveBeenCalledWith(
      'Falha ao enviar "Assunto" para fu***@example.com: 550 <fu***@example.com>: mailbox unavailable',
    );
  });

  it('grava FAILURE (sem lançar), loga o erro e devolve false quando o envio rejeita', async () => {
    mail.send.mockRejectedValueOnce(new Error('conexão recusada'));

    await expect(notifier.send(data)).resolves.toBe(false);

    expect(saved[0].status).toBe(NotificationStatus.FAILURE);
    expect(saved[0].error).toBe('conexão recusada');
    expect(logger.error).toHaveBeenCalledWith(
      'Falha ao enviar "Assunto" para fu***@example.com: conexão recusada',
    );
  });

  it('propaga a falha ao gravar o log, para o BullMQ tentar de novo', async () => {
    logs.save.mockRejectedValueOnce(new Error('banco fora do ar'));

    await expect(notifier.send(data)).rejects.toThrow('banco fora do ar');
  });
});
