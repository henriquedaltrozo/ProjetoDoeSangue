import {
  OUTBOX_RECONCILIATION_WINDOW_DAYS,
  OUTBOX_MAX_REPROCESSINGS,
  OUTBOX_PROCESSED_RETENTION_DAYS,
  OutboxEvent,
} from '../../../domain/outbox';
import { CLOCK, Clock, LOGGER, LoggerPort, OUTBOX_REPOSITORY, OutboxRepository } from '../../ports';

export interface ReconciliationResult {
  eventsCreated: number;
  eventsReactivated: number;
  permanentFailures: number;
  /** Eventos já processados, antigos, apagados nesta rodada. */
  eventsPurged: number;
}

/**
 * Rede de segurança do outbox, executada periodicamente (e sob demanda pelo admin):
 *  1. Conclusões sem evento: agendamentos COMPLETED (últimos dias) que não têm nenhum evento
 *     `DONATION_COMPLETED` ganham um. Só vale para conclusões posteriores ao primeiro evento do
 *     outbox, para não reenviar e-mails de doações anteriores à introdução do outbox.
 *  2. Falhas: eventos em FAILURE, depois do período de espera, voltam para PENDING (até
 *     OUTBOX_MAX_REPROCESSINGS vezes).
 *  3. Alerta: eventos que passaram do limite de reprocessamentos ficam em FAILURE e geram um log
 *     de erro a cada ciclo, até um admin tratá-los (`POST /outbox/:id/reprocess`).
 *  4. Limpeza: eventos processados há mais de OUTBOX_PROCESSED_RETENTION_DAYS dias são apagados.
 * É seguro rodar em várias instâncias ao mesmo tempo: os handlers são idempotentes.
 */
export class ReconcileOutboxUseCase {
  static readonly inject = [OUTBOX_REPOSITORY, LOGGER, CLOCK] as const;

  constructor(
    private readonly outbox: OutboxRepository,
    private readonly logger: LoggerPort,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<ReconciliationResult> {
    try {
      const result: ReconciliationResult = {
        eventsCreated: await this.createMissingEvents(),
        eventsReactivated: await this.outbox.reactivateFailuresExpired(OUTBOX_MAX_REPROCESSINGS),
        permanentFailures: await this.outbox.countPermanentFailures(OUTBOX_MAX_REPROCESSINGS),
        eventsPurged: await this.outbox.purgeProcessed(
          new Date(this.clock.now().getTime() - OUTBOX_PROCESSED_RETENTION_DAYS * 86_400_000),
        ),
      };
      if (result.eventsCreated || result.eventsReactivated) {
        this.logger.warn(
          `Reconciliação: ${result.eventsCreated} evento(s) criado(s), ` +
            `${result.eventsReactivated} reativado(s).`,
          ReconcileOutboxUseCase.name,
        );
      }
      if (result.permanentFailures) {
        this.logger.error(
          `ALERT: ${result.permanentFailures} evento(s) do outbox em FAILURE definitiva - ` +
            'reprocesse com POST /outbox/:id/reprocess após corrigir a causa.',
          ReconcileOutboxUseCase.name,
        );
      }
      return result;
    } catch (err) {
      this.logger.error(
        `Falha na reconciliação do outbox: ${(err as Error).message}`,
        ReconcileOutboxUseCase.name,
      );
      return { eventsCreated: 0, eventsReactivated: 0, permanentFailures: 0, eventsPurged: 0 };
    }
  }

  private async createMissingEvents(): Promise<number> {
    const first = await this.outbox.findFirstEventDate();
    if (!first) return 0; // nenhum evento ainda: não há como saber o que é anterior ao outbox

    const missing = await this.outbox.listCompletionsWithoutEvent(
      first,
      OUTBOX_RECONCILIATION_WINDOW_DAYS,
    );
    for (const completion of missing) {
      await this.outbox.create(
        OutboxEvent.donationCompleted({
          appointmentId: completion.appointmentId,
          donorId: completion.donorId,
          appointmentDateTime: completion.appointmentDateTime,
        }),
      );
    }
    return missing.length;
  }
}
