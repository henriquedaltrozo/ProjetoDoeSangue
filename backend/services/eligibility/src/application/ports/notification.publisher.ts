import type { EligibleAgainJobPayload } from '@shared/application/messaging';

export const NOTIFICATION_PUBLISHER = Symbol('NOTIFICATION_PUBLISHER');

/** Fila de e-mails (consumida pelo notification-service). */
export interface NotificationPublisher {
  /** Aviso "você já pode doar". Idempotente: um por doador e dia. */
  enqueueEligibleAgain(payload: EligibleAgainJobPayload): Promise<void>;
}
