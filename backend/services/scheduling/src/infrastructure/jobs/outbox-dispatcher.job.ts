import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DispatchOutboxUseCase } from '../../application/use-cases/outbox/dispatch-outbox.use-case';

export const OUTBOX_INTERVAL_POLLING_MS = 2_000;

/** Gatilho periódico do despachante do outbox (desligável com OUTBOX_DISPATCHER_ENABLED=false). */
@Injectable()
export class OutboxDispatcherJob implements OnApplicationBootstrap, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly dispatch: DispatchOutboxUseCase,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.get<string>('OUTBOX_DISPATCHER_ENABLED', 'true') === 'false') return;
    this.timer = setInterval(() => {
      void this.dispatch.execute();
    }, OUTBOX_INTERVAL_POLLING_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
