import type { Actor } from '@shared/application/auth';
import { Role } from '@shared/domain/enums';
import { AuditAction } from '../../domain/entities/access-audit';
import { type EligibilityAssessmentOutput, toEligibilityAssessmentOutput } from '../dto';
import { AccessDeniedError } from '../errors';
import { ASSESSMENT_REPOSITORY, type AssessmentRepository } from '../ports/assessment.repository';
import { DONOR_REPOSITORY, type DonorRepository } from '../ports/donor.repository';
import { AuditTrail } from '../services/audit-trail';
import { loadDonorOrFail } from './shared/load-donor';

/**
 * [admin] Avaliações registradas do doador (as dos agendamentos e do pós-doação), para conferir por
 * que um agendamento foi aceito. O doador não vê esta lista: a situação dele é a consulta "Posso doar
 * hoje?", e a cópia de tudo sai na exportação de dados (LGPD). Auditado.
 */
export class EligibilityHistoryUseCase {
  static readonly inject = [DONOR_REPOSITORY, ASSESSMENT_REPOSITORY, AuditTrail] as const;

  constructor(
    private readonly donors: DonorRepository,
    private readonly assessments: AssessmentRepository,
    private readonly audit: AuditTrail,
  ) {}

  async execute(donorId: string, actor: Actor): Promise<EligibilityAssessmentOutput[]> {
    if (actor.role !== Role.ADMIN) {
      throw new AccessDeniedError('Somente administradores veem o histórico de avaliações.');
    }
    await loadDonorOrFail(this.donors, donorId);
    const list = await this.assessments.listByDonor(donorId);
    await this.audit.record(donorId, actor, AuditAction.VIEW);
    return list.map(toEligibilityAssessmentOutput);
  }
}
