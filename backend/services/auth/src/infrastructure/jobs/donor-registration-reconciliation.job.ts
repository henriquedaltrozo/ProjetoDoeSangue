import { Injectable, OnApplicationBootstrap, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReconcileDonorRegistrationsUseCase } from '../../application/use-cases/reconcile-donor-registrations.use-case';

export const DONOR_RECONCILIATION_INTERVAL_MS = 60_000;

/** Gatilho periódico da reconciliação de cadastros (desligável com DONOR_RECONCILIATION_ENABLED=false). */
@Injectable()
export class DonorRegistrationReconciliationJob implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(DonorRegistrationReconciliationJob.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly reconcile: ReconcileDonorRegistrationsUseCase,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.get<string>('DONOR_RECONCILIATION_ENABLED', 'true') === 'false') return;
    this.timer = setInterval(() => {
      void this.reconcile
        .execute()
        .catch((err) =>
          this.logger.warn(`Falha na reconciliação de cadastros: ${(err as Error).message}`),
        );
    }, DONOR_RECONCILIATION_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
