import { EligibilityAssessment } from '../../../domain/entities/assessment-eligibility';
import { EligibilityAssessmentOrmEntity } from '../orm-entities/assessment-eligibility.orm-entity';

export const EligibilityAssessmentMapper = {
  toDomain(orm: EligibilityAssessmentOrmEntity): EligibilityAssessment {
    return new EligibilityAssessment({
      id: orm.id,
      donorId: orm.donorId,
      appointmentId: orm.appointmentId ?? null,
      result: orm.result,
      reasons: orm.reasons,
      notices: orm.notices ?? [],
      nextEligibilityDate: orm.nextEligibilityDate ?? null,
      origin: orm.origin,
      assessedAt: orm.assessedAt,
    });
  },
};
