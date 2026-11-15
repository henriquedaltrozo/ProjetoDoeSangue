import { NewOutboxEvent, OutboxEvent } from '../../../domain/outbox';
import { OutboxEventOrmEntity } from '../orm-entities/outbox-event.orm-entity';

export const OutboxEventMapper = {
  toDomain(orm: OutboxEventOrmEntity): OutboxEvent {
    return new OutboxEvent({
      id: orm.id,
      type: orm.type,
      payload: orm.payload,
      status: orm.status,
      attempts: orm.attempts,
      reprocessings: orm.reprocessings,
      nextAttemptAt: orm.nextAttemptAt,
      lastError: orm.lastError,
      createdAt: orm.createdAt,
      processedAt: orm.processedAt,
    });
  },

  toOrm(event: OutboxEvent): OutboxEventOrmEntity {
    return Object.assign(new OutboxEventOrmEntity(), {
      id: event.id,
      type: event.type,
      payload: event.payload,
      status: event.status,
      attempts: event.attempts,
      reprocessings: event.reprocessings,
      nextAttemptAt: event.nextAttemptAt,
      lastError: event.lastError,
      createdAt: event.createdAt,
      processedAt: event.processedAt,
    });
  },

  /** Só tipo e payload: os demais campos nascem dos defaults do banco. */
  newToOrm(draft: NewOutboxEvent): OutboxEventOrmEntity {
    return Object.assign(new OutboxEventOrmEntity(), { type: draft.type, payload: draft.payload });
  },
};
