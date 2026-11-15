import { NotificationJobType } from '@shared/domain/enums';
import { NotificationChannel, NotificationStatus } from '@src/domain/enums';
import { NotificationLog } from '@src/domain/entities/notification-log';

describe('NotificationLog', () => {
  const data = {
    donorId: 'donor-1',
    type: NotificationJobType.REMINDER_24H,
    recipient: 'fulano@example.com',
    subject: 'Assunto',
    message: 'Mensagem',
    jobId: 'job-1',
  };

  it('nasce SENT, por e-mail, sem erro', () => {
    const log = NotificationLog.byEmail(data);

    expect(log.status).toBe(NotificationStatus.SENT);
    expect(log.channel).toBe(NotificationChannel.EMAIL);
    expect(log.error).toBeNull();
    expect(log.failed).toBe(false);
    expect(log.id).toBeNull();
  });

  it('normaliza campos omitidos para null', () => {
    const log = NotificationLog.byEmail({ ...data, donorId: undefined, jobId: undefined });

    expect(log.donorId).toBeNull();
    expect(log.userId).toBeNull();
    expect(log.jobId).toBeNull();
  });

  it('markFailure muda o status para FAILURE e guarda o motivo', () => {
    const log = NotificationLog.byEmail(data);

    log.markFailure('conexão recusada');

    expect(log.status).toBe(NotificationStatus.FAILURE);
    expect(log.error).toBe('conexão recusada');
    expect(log.failed).toBe(true);
  });
});
