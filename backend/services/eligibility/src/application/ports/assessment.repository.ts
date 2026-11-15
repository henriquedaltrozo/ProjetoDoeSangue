import type { AssessmentSource } from '@shared/domain/enums';
import type {
  EligibilityAssessment,
  NewEligibilityAssessment,
} from '../../domain/entities/assessment-eligibility';

export interface AssessmentRepository {
  create(draft: NewEligibilityAssessment): Promise<EligibilityAssessment>;
  /** Mais recentes primeiro (por assessedAt). */
  listByDonor(donorId: string): Promise<EligibilityAssessment[]>;
  /** A avaliação mais recente deste agendamento com esta origem, se houver. */
  findByAppointment(
    appointmentId: string,
    origin: AssessmentSource,
  ): Promise<EligibilityAssessment | null>;
}

export const ASSESSMENT_REPOSITORY = Symbol('AssessmentRepository');
