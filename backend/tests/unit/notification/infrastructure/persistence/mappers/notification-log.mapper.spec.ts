import { NotificationJobType } from '@shared/domain/enums';
import { NotificationChannel, NotificationStatus } from '@src/domain/enums';
import { NotificationLog } from '@src/domain/entities/notification-log';
import { NotificationLogOrmEntity } from '@src/infrastructure/persistence/orm-entities/notification-log.orm-entity';
import { NotificationLogMapper } from '@src/infrastructure/persistence/mappers/notification-log.mapper';

describe('NotificationLogMapper', () => {
  it('toOrm não envia id/sentAt de um log novo (o banco os gera)', () => {
    const log = NotificationLog.byEmail({
      userId: 'u1',
      type: NotificationJobType.RESET_PASSWORD,
      recipient: 'a@example.com',
      subject: 'A',
      message: 'M',
      jobId: 'job-1',
    });
    log.markFailure('error');

    const orm = NotificationLogMapper.toOrm(log);

    expect(orm).toEqual({
      donorId: null,
      userId: 'u1',
      type: NotificationJobType.RESET_PASSWORD,
      channel: NotificationChannel.EMAIL,
      recipient: 'a@example.com',
      subject: 'A',
      message: 'M',
      status: NotificationStatus.FAILURE,
      error: 'error',
      jobId: 'job-1',
    });
    expect(orm).not.toHaveProperty('id');
  });

  it('toDomain reconstitui o modelo a partir da entidade ORM', () => {
    const sentAt = new Date('2026-10-10T13:00:00Z');
    const orm = Object.assign(new NotificationLogOrmEntity(), {
      id: 'id-1',
      donorId: 'd1',
      userId: null,
      type: NotificationJobType.REMINDER_24H,
      channel: NotificationChannel.EMAIL,
      recipient: 'a@example.com',
      subject: 'A',
      message: 'M',
      status: NotificationStatus.FAILURE,
      error: 'x',
      jobId: null,
      sentAt,
    });

    const log = NotificationLogMapper.toDomain(orm);

    expect(log.id).toBe('id-1');
    expect(log.failed).toBe(true);
    expect(log.error).toBe('x');
    expect(log.sentAt).toBe(sentAt);
    expect(NotificationLogMapper.toOrm(log)).toMatchObject({ id: 'id-1', sentAt });
  });
});
