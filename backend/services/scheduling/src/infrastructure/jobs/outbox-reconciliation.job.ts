import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReconcileOutboxUseCase } from '../../application/use-cases/outbox/reconcile-outbox.use-case';

export const OUTBOX_RECONCILIATION_INTERVAL_MS = 10 * 60_000;

/** Gatilho periódico da reconciliação do outbox (desligável com OUTBOX_DISPATCHER_ENABLED=false). */
@Injectable()
export class OutboxReconciliationJob implements OnApplicationBootstrap, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly reconcile: ReconcileOutboxUseCase,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.get<string>('OUTBOX_DISPATCHER_ENABLED', 'true') === 'false') return;
    this.timer = setInterval(() => {
      void this.reconcile.execute();
    }, OUTBOX_RECONCILIATION_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
