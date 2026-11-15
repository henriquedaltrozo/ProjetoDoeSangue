import {
  type EligibilityAssessmentOutput,
  type EligibilityCheckOutput,
  toEligibilityAssessmentOutput,
} from '../dto';
import { Actor, requireOwnerOrAdmin } from '@shared/application/auth';
import { CLOCK, Clock } from '@shared/application/ports';
import { AssessEligibilityInput } from '@shared/application/dto';
import { assessEligibility, effectiveDonationDay } from '../../domain/services/assess-eligibility';
import { ASSESSMENT_REPOSITORY, type AssessmentRepository } from '../ports/assessment.repository';
import { DONOR_REPOSITORY, type DonorRepository } from '../ports/donor.repository';
import { UNFITNESS_REPOSITORY, type UnfitnessRepository } from '../ports/unfitness.repository';
import { loadDonorOrFail } from './shared/load-donor';
import { AssessmentSource } from '@shared/domain/enums';
import { AccessDeniedError } from '../errors';

/**
 * Avalia a elegibilidade de um doador agora. As avaliações dos agendamentos e do pós-doação (rota
 * interna) são gravadas: o agendamento aponta para a avaliação que o liberou. A consulta do doador
 * (rota pública) só responde, sem gravar: guardar cada clique não tem finalidade, e a LGPD pede não
 * reter dado de saúde sem necessidade.
 */
export class AssessEligibilityUseCase {
  static readonly inject = [
    DONOR_REPOSITORY,
    UNFITNESS_REPOSITORY,
    ASSESSMENT_REPOSITORY,
    CLOCK,
  ] as const;

  constructor(
    private readonly donors: DonorRepository,
    private readonly unfitness: UnfitnessRepository,
    private readonly assessments: AssessmentRepository,
    private readonly clock: Clock,
  ) {}

  /**
   * Variante do endpoint público: o doador só consulta a si mesmo (admin consulta qualquer um), e só
   * como consulta. As avaliações de agendamento e de pós-doação vêm do scheduling pela rota interna,
   * que é quem conhece o agendamento e o dia da doação.
   */
  async executeAs(dto: AssessEligibilityInput, actor: Actor): Promise<EligibilityCheckOutput> {
    requireOwnerOrAdmin(actor, dto.donorId);
    if (dto.origin !== AssessmentSource.DONOR_QUERY) {
      throw new AccessDeniedError('Esta origem de avaliação é reservada ao processamento interno.');
    }
    const now = this.clock.now();
    const outcome = await this.evaluate(dto.donorId, now);
    return {
      donorId: dto.donorId,
      result: outcome.result,
      reasons: outcome.reasons,
      notices: outcome.notices,
      nextEligibilityDate: outcome.nextEligibilityDate,
      origin: AssessmentSource.DONOR_QUERY,
      assessedAt: now,
    };
  }

  /**
   * [interno] Avalia e grava a avaliação (agendamento, check-in, pós-doação). A do pós-doação é uma
   * por agendamento: o outbox pode repetir o evento, e repetir devolve a avaliação já gravada.
   */
  async execute(dto: AssessEligibilityInput): Promise<EligibilityAssessmentOutput> {
    if (dto.origin === AssessmentSource.POST_DONATION && dto.appointmentId) {
      const existing = await this.assessments.findByAppointment(dto.appointmentId, dto.origin);
      if (existing) return toEligibilityAssessmentOutput(existing);
    }
    const outcome = await this.evaluate(dto.donorId, this.clock.now(), dto.donationDate);
    return toEligibilityAssessmentOutput(
      await this.assessments.create({
        donorId: dto.donorId,
        appointmentId: dto.appointmentId ?? null,
        result: outcome.result,
        reasons: outcome.reasons,
        notices: outcome.notices,
        nextEligibilityDate: outcome.nextEligibilityDate,
        origin: dto.origin,
      }),
    );
  }

  private async evaluate(donorId: string, now: Date, donationDate?: string) {
    const donor = await loadDonorOrFail(this.donors, donorId);
    // A inaptidão que importa é a que estará em vigor no dia da doação, não hoje.
    const activeUnfitness = donor.permanentUnfit
      ? null
      : await this.unfitness.findActive(donor.id, effectiveDonationDay(now, donationDate));
    return assessEligibility({ donor, activeUnfitness, now, donationDate });
  }
}
