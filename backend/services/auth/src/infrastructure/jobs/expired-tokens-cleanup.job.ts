import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PurgeExpiredTokensUseCase } from '../../application/use-cases/purge-expired-tokens.use-case';

export const TOKENS_CLEANUP_INTERVAL_MS = 60 * 60_000;

/** Gatilho periódico (a cada hora) da limpeza de tokens vencidos (desligável com TOKENS_CLEANUP_ENABLED=false). */
@Injectable()
export class ExpiredTokensCleanupJob implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ExpiredTokensCleanupJob.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly purge: PurgeExpiredTokensUseCase,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.get<string>('TOKENS_CLEANUP_ENABLED', 'true') === 'false') return;
    this.timer = setInterval(() => {
      void this.purge
        .execute()
        .catch((err) =>
          this.logger.warn(`Falha na limpeza de tokens vencidos: ${(err as Error).message}`),
        );
    }, TOKENS_CLEANUP_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
