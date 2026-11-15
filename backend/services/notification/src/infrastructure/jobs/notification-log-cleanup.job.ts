import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { PurgeNotificationLogsUseCase } from '../../application/use-cases/purge-notification-logs.use-case';

export const NOTIFICATION_LOG_CLEANUP_INTERVAL_MS = 6 * 60 * 60_000;

/** Gatilho periódico (ao subir e a cada 6 h) da limpeza do registro de envios. */
@Injectable()
export class NotificationLogCleanupJob implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(NotificationLogCleanupJob.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly purge: PurgeNotificationLogsUseCase) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.run(), NOTIFICATION_LOG_CLEANUP_INTERVAL_MS);
    this.timer.unref();
    void this.run();
  }

  /** Melhor esforço: uma falha só fica no log e a limpeza roda de novo no próximo ciclo. */
  async run(now: Date = new Date()): Promise<void> {
    try {
      await this.purge.execute(now);
    } catch (err) {
      this.logger.error(`Falha na limpeza do registro de envios: ${(err as Error).message}`);
    }
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
