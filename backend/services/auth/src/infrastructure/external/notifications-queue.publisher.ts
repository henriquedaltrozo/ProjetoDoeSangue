import {
  ERASE_PERSONAL_DATA_JOB,
  type ErasePersonalDataJobPayload,
  NOTIFICATIONS_QUEUE_NAME,
} from '@shared/application/messaging';
import { NotificationJobType } from '@shared/domain/enums';
import { DEFAULT_JOB_OPTIONS } from '@shared/infrastructure/messaging';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { AccountNoticePayload } from '../../application/ports/account-notice-outbox';
import {
  NotificationPublisher,
  ResetPasswordNotification,
} from '../../application/ports/notification.publisher';

/** Publica na fila `notifications` (consumida pelo notification-service). */
@Injectable()
export class NotificationsQueuePublisher implements NotificationPublisher {
  constructor(@InjectQueue(NOTIFICATIONS_QUEUE_NAME) private readonly queue: Queue) {}

  async enqueueErasePersonalData(userId: string, donorId: string | null): Promise<void> {
    const payload: ErasePersonalDataJobPayload = { userId, donorId };
    await this.queue.add(ERASE_PERSONAL_DATA_JOB, payload, {
      ...DEFAULT_JOB_OPTIONS,
      jobId: `erase-${userId}`,
    });
  }

  async enqueueResetPassword(notification: ResetPasswordNotification): Promise<void> {
    await this.queue.add(
      NotificationJobType.RESET_PASSWORD,
      { type: NotificationJobType.RESET_PASSWORD, ...notification },
      DEFAULT_JOB_OPTIONS,
    );
  }

  async enqueueAccountNotice(payload: AccountNoticePayload, jobId: string): Promise<void> {
    await this.queue.add(payload.type, payload, {
      ...DEFAULT_JOB_OPTIONS,
      jobId,
      removeOnComplete: { age: 7 * 24 * 3600 },
    });
  }
}
