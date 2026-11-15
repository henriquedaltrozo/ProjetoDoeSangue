import { NOTIFICATIONS_QUEUE_NAME } from '@shared/application/messaging';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { FailedJobSummary, FailedJobs } from '../../application/ports/failed-jobs.port';

/** Jobs em falha definitiva na fila `notifications` (o BullMQ os guarda por 7 dias). */
@Injectable()
export class BullMqFailedJobs implements FailedJobs {
  constructor(@InjectQueue(NOTIFICATIONS_QUEUE_NAME) private readonly queue: Queue) {}

  async list(limit: number): Promise<FailedJobSummary[]> {
    const jobs = await this.queue.getFailed(0, limit - 1);
    return jobs
      .filter((job) => job?.id)
      .map((job) => ({
        id: String(job.id),
        type: job.name,
        failedReason: job.failedReason ?? '',
        attemptsMade: job.attemptsMade,
        failedAt: job.finishedOn ? new Date(job.finishedOn) : null,
      }));
  }

  async retry(id: string): Promise<boolean> {
    const job = await this.queue.getJob(id);
    if (!job || !(await job.isFailed())) return false;
    await job.retry('failed');
    return true;
  }
}
