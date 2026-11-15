import type { OutboxEventOutput, OutboxEventType, OutboxStatus } from '../../../application/dto';

/** Representação HTTP de um evento do outbox (visão do admin). */
export interface OutboxEventResponse {
  id: string;
  type: OutboxEventType;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  reprocessings: number;
  nextAttemptAt: Date;
  lastError: string | null;
  createdAt: Date;
  processedAt: Date | null;
}

export function toOutboxEventResponse(event: OutboxEventOutput): OutboxEventResponse {
  return {
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
  };
}
