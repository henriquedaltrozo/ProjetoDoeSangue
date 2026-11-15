import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DispatchAccountNoticesUseCase } from '../../application/use-cases/dispatch-account-notices.use-case';

export const ACCOUNT_NOTICES_POLLING_MS = 5_000;

/** Gatilho periódico do despachante de avisos da conta (desligável com OUTBOX_DISPATCHER_ENABLED=false). */
@Injectable()
export class AccountNoticesDispatcherJob implements OnApplicationBootstrap, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly dispatch: DispatchAccountNoticesUseCase,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.get<string>('OUTBOX_DISPATCHER_ENABLED', 'true') === 'false') return;
    this.timer = setInterval(() => void this.dispatch.execute(), ACCOUNT_NOTICES_POLLING_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
