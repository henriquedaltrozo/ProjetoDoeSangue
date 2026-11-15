import { toBusinessDate, toBusinessWeekdayTime } from '@shared/domain/time';
import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotifyEligibleAgainUseCase } from '../../application/use-cases/notify-eligible-again.use-case';

/** De quanto em quanto tempo a rotina confere se já é hora de rodar. */
export const ELIGIBLE_AGAIN_CHECK_INTERVAL_MS = 15 * 60_000;
/** A partir de que horário (Brasília) os avisos do dia saem: ninguém recebe e-mail de madrugada. */
export const ELIGIBLE_AGAIN_SEND_FROM = '08:00';

/**
 * Gatilho diário do aviso "você já pode doar" (desligável com ELIGIBLE_AGAIN_JOB_ENABLED=false).
 * Confere a cada 15 min; roda uma vez por dia, depois das 8h. Se algum aviso não entrar na fila,
 * tenta de novo no próximo ciclo (os já enfileirados não se repetem: jobId por doador e dia).
 */
@Injectable()
export class EligibleAgainJob implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(EligibleAgainJob.name);
  private timer?: NodeJS.Timeout;
  private lastRunDay: string | null = null;
  private running = false;

  constructor(
    private readonly notifyEligibleAgain: NotifyEligibleAgainUseCase,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.get<string>('ELIGIBLE_AGAIN_JOB_ENABLED', 'true') === 'false') return;
    this.timer = setInterval(() => void this.tick(), ELIGIBLE_AGAIN_CHECK_INTERVAL_MS);
    this.timer.unref();
    void this.tick();
  }

  /** Roda a rotina se já passou do horário e ela ainda não rodou (com sucesso) hoje. */
  async tick(now: Date = new Date()): Promise<void> {
    const today = toBusinessDate(now);
    if (this.running || this.lastRunDay === today) return;
    if (toBusinessWeekdayTime(now).time < ELIGIBLE_AGAIN_SEND_FROM) return;
    this.running = true;
    try {
      const { notified, failed } = await this.notifyEligibleAgain.execute();
      if (failed === 0) this.lastRunDay = today;
      this.logger.log(
        `Avisos de "já pode doar" de ${today}: ${notified} enfileirado(s), ${failed} falha(s).`,
      );
    } catch (err) {
      this.logger.error(`Falha na rotina de "já pode doar": ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
