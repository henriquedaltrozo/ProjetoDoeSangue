import {
  type EligibleAgainJobPayload,
  NOTIFICATIONS_QUEUE_NAME,
} from '@shared/application/messaging';
import { NotificationJobType } from '@shared/domain/enums';
import { DEFAULT_JOB_OPTIONS } from '@shared/infrastructure/messaging';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { NotificationPublisher } from '../../application/ports/notification.publisher';

/** Publica na fila `notifications` (consumida pelo notification-service). */
@Injectable()
export class NotificationQueuePublisher implements NotificationPublisher {
  constructor(@InjectQueue(NOTIFICATIONS_QUEUE_NAME) private readonly queue: Queue) {}

  /**
   * jobId fixo por doador e dia: a rotina diária pode rodar de novo (outra instância, reinício)
   * sem gerar um segundo e-mail. Os concluídos ficam alguns dias para valer a regra.
   */
  async enqueueEligibleAgain(payload: EligibleAgainJobPayload): Promise<void> {
    await this.queue.add(NotificationJobType.ELIGIBLE_AGAIN, payload, {
      ...DEFAULT_JOB_OPTIONS,
      jobId: `eligible-${payload.donorId}-${payload.eligibleSince}`,
      removeOnComplete: { age: 3 * 24 * 3600 },
    });
  }
}
