import { AssessmentNotice } from '../../domain/enums/assessment-notice.enum';
import { IneligibilityReason } from '../../domain/enums/ineligibility-reason.enum';
import { AssessmentSource } from '../../domain/enums/assessment-source.enum';
import { EligibilityResult } from '../../domain/enums/eligibility-result.enum';

export interface EligibilityAssessmentOutput {
  id: string;
  donorId: string;
  appointmentId: string | null;
  result: EligibilityResult;
  reasons: IneligibilityReason[];
  /** Avisos de uma avaliação apta (ex.: levar o termo do responsável). */
  notices: AssessmentNotice[];
  nextEligibilityDate: string | null;
  origin: AssessmentSource;
  assessedAt: string;
}
