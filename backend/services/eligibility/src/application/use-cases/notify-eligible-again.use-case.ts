import { CLOCK, type Clock, LOGGER, type LoggerPort } from '@shared/application/ports';
import { EligibilityResult, NotificationJobType } from '@shared/domain/enums';
import type { Donor } from '../../domain/entities/donor';
import { TemporaryUnfitness } from '../../domain/entities/temporary-unfitness';
import { assessEligibility } from '../../domain/services/assess-eligibility';
import { toDateISO } from '../../domain/services/dates';
import { DONOR_REPOSITORY, type DonorRepository } from '../ports/donor.repository';
import {
  NOTIFICATION_PUBLISHER,
  type NotificationPublisher,
} from '../ports/notification.publisher';
import { SCHEDULING_GATEWAY, type SchedulingGateway } from '../ports/scheduling.gateway';
import { UNFITNESS_REPOSITORY, type UnfitnessRepository } from '../ports/unfitness.repository';

const DAY_MS = 86_400_000;

export interface EligibleAgainResult {
  notified: number;
  /** Avisos que não entraram na fila (ex.: Redis fora): a rotina tenta de novo mais tarde. */
  failed: number;
}

/**
 * Rotina diária: avisa por e-mail quem volta a poder doar hoje. Volta a poder doar quem ontem
 * estava inapto com uma data prometida (fim do intervalo mínimo, do limite anual ou de uma
 * inaptidão temporária) que é hoje, e hoje está apto. A decisão usa os dados do dia (o motor de
 * elegibilidade), e não uma data calculada meses antes: quem nesse meio-tempo recebeu uma inaptidão,
 * doou de novo ou excluiu a conta não recebe o aviso. Só quem aceita avisos (ver
 * `Donor.receiveAlerts`) e ainda não tem agendamento em aberto (quem já agendou não precisa do
 * convite). Idempotente: um aviso por doador e dia. Se o scheduling não responder, a rodada falha
 * inteira e é refeita no próximo ciclo (melhor atrasar do que avisar quem já agendou).
 */
export class NotifyEligibleAgainUseCase {
  static readonly inject = [
    DONOR_REPOSITORY,
    UNFITNESS_REPOSITORY,
    NOTIFICATION_PUBLISHER,
    CLOCK,
    LOGGER,
    SCHEDULING_GATEWAY,
  ] as const;

  constructor(
    private readonly donors: DonorRepository,
    private readonly unfitness: UnfitnessRepository,
    private readonly publisher: NotificationPublisher,
    private readonly clock: Clock,
    private readonly logger: LoggerPort,
    private readonly scheduling: SchedulingGateway,
  ) {}

  async execute(): Promise<EligibleAgainResult> {
    const now = this.clock.now();
    const yesterday = new Date(now.getTime() - DAY_MS);
    const todayISO = toDateISO(now);

    const donors = await this.donors.listAcceptingAlerts();
    const ids = donors.map((d) => d.id);
    const [activeToday, activeYesterday] = await Promise.all([
      this.unfitness.listActiveForDonors(ids, todayISO),
      this.unfitness.listActiveForDonors(ids, toDateISO(yesterday)),
    ]);
    const today = byDonor(activeToday);
    const before = byDonor(activeYesterday);

    const candidates = donors.filter((donor) =>
      this.becameEligibleToday(donor, before, today, yesterday, now, todayISO),
    );
    const scheduled = new Set(
      await this.scheduling.donorsWithOpenAppointment(candidates.map((d) => d.id)),
    );

    const result: EligibleAgainResult = { notified: 0, failed: 0 };
    for (const donor of candidates) {
      if (scheduled.has(donor.id)) continue;
      try {
        await this.publisher.enqueueEligibleAgain({
          type: NotificationJobType.ELIGIBLE_AGAIN,
          donorId: donor.id,
          donorName: donor.completeName,
          recipientEmail: donor.email,
          eligibleSince: todayISO,
        });
        result.notified += 1;
      } catch (err) {
        result.failed += 1;
        this.logger.error(
          `Falha ao enfileirar o aviso de "já pode doar" (doador ${donor.id}): ${(err as Error).message}`,
        );
      }
    }
    return result;
  }

  private becameEligibleToday(
    donor: Donor,
    before: Map<string, TemporaryUnfitness>,
    today: Map<string, TemporaryUnfitness>,
    yesterday: Date,
    now: Date,
    todayISO: string,
  ): boolean {
    const wasBlocked = assessEligibility({
      donor,
      activeUnfitness: before.get(donor.id) ?? null,
      now: yesterday,
    });
    if (
      wasBlocked.result !== EligibilityResult.TEMPORARY_UNFIT ||
      wasBlocked.nextEligibilityDate !== todayISO
    ) {
      return false;
    }
    const isFree = assessEligibility({
      donor,
      activeUnfitness: today.get(donor.id) ?? null,
      now,
    });
    return isFree.result === EligibilityResult.ELIGIBLE;
  }
}

/** A inaptidão em vigor de cada doador; com mais de uma, a que mais restringe (como em findActive). */
function byDonor(list: TemporaryUnfitness[]): Map<string, TemporaryUnfitness> {
  const grouped = new Map<string, TemporaryUnfitness[]>();
  for (const u of list) grouped.set(u.donorId, [...(grouped.get(u.donorId) ?? []), u]);
  const map = new Map<string, TemporaryUnfitness>();
  for (const [donorId, items] of grouped) {
    const chosen = TemporaryUnfitness.mostRestrictive(items);
    if (chosen) map.set(donorId, chosen);
  }
  return map;
}
