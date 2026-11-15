import { NotificationLog } from '../../../domain/entities/notification-log';
import { NotificationLogOrmEntity } from '../orm-entities/notification-log.orm-entity';

export const NotificationLogMapper = {
  toDomain(orm: NotificationLogOrmEntity): NotificationLog {
    return new NotificationLog({
      id: orm.id,
      donorId: orm.donorId,
      userId: orm.userId,
      type: orm.type,
      channel: orm.channel,
      recipient: orm.recipient,
      subject: orm.subject,
      message: orm.message,
      status: orm.status,
      error: orm.error,
      jobId: orm.jobId,
      sentAt: orm.sentAt,
    });
  },

  /** `id` e `sentAt` só são enviados quando já existem; senão o banco os gera. */
  toOrm(log: NotificationLog): Partial<NotificationLogOrmEntity> {
    return {
      ...(log.id ? { id: log.id } : {}),
      donorId: log.donorId,
      userId: log.userId,
      type: log.type,
      channel: log.channel,
      recipient: log.recipient,
      subject: log.subject,
      message: log.message,
      status: log.status,
      error: log.error,
      jobId: log.jobId,
      ...(log.sentAt ? { sentAt: log.sentAt } : {}),
    };
  },
};
