import { type Actor, requireOwnerOrAdmin } from '@shared/application/auth';
import { AuditAction } from '../../domain/entities/access-audit';
import {
  type DonorDataExportOutput,
  toDonorOutput,
  toEligibilityAssessmentOutput,
  toTemporaryUnfitnessOutput,
} from '../dto';
import { ASSESSMENT_REPOSITORY, type AssessmentRepository } from '../ports/assessment.repository';
import { DONOR_REPOSITORY, type DonorRepository } from '../ports/donor.repository';
import { UNFITNESS_REPOSITORY, type UnfitnessRepository } from '../ports/unfitness.repository';
import { AuditTrail } from '../services/audit-trail';
import { loadDonorOrFail } from './shared/load-donor';

/**
 * [LGPD] Portabilidade de dados: reúne, num único payload, tudo que o eligibility-service guarda
 * sobre o doador (cadastro, inaptidões e avaliações). Identidade (login) e agendamentos vivem em
 * outros serviços e não entram aqui. Só o próprio doador ou um admin; auditado.
 */
export class ExportDataUseCase {
  static readonly inject = [
    DONOR_REPOSITORY,
    UNFITNESS_REPOSITORY,
    ASSESSMENT_REPOSITORY,
    AuditTrail,
  ] as const;

  constructor(
    private readonly donors: DonorRepository,
    private readonly unfitness: UnfitnessRepository,
    private readonly assessments: AssessmentRepository,
    private readonly audit: AuditTrail,
  ) {}

  async execute(donorId: string, actor: Actor): Promise<DonorDataExportOutput> {
    requireOwnerOrAdmin(actor, donorId);
    const donor = await loadDonorOrFail(this.donors, donorId);
    const [temporaryUnfitness, eligibilityAssessments] = await Promise.all([
      this.unfitness.listByDonor(donorId),
      this.assessments.listByDonor(donorId),
    ]);
    await this.audit.record(donorId, actor, AuditAction.EXPORT);
    return {
      donor: toDonorOutput(donor),
      temporaryUnfitness: temporaryUnfitness.map(toTemporaryUnfitnessOutput),
      eligibilityAssessments: eligibilityAssessments.map(toEligibilityAssessmentOutput),
    };
  }
}
