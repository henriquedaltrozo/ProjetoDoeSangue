import {
  AssessmentNotice,
  IneligibilityReason,
  AssessmentSource,
  EligibilityResult,
} from '@shared/domain/enums';

export interface EligibilityAssessmentProps {
  id: string;
  donorId: string;
  appointmentId: string | null;
  result: EligibilityResult;
  reasons: IneligibilityReason[];
  /** Avisos de uma avaliação apta; ausente equivale a nenhum. */
  notices?: AssessmentNotice[];
  nextEligibilityDate: string | null;
  origin: AssessmentSource;
  assessedAt: Date;
}

export type NewEligibilityAssessment = Omit<EligibilityAssessmentProps, 'id' | 'assessedAt'>;

/** Log auditável de cada verificação de elegibilidade. */
export class EligibilityAssessment {
  readonly id: string;
  readonly donorId: string;
  readonly appointmentId: string | null;
  readonly result: EligibilityResult;
  readonly reasons: IneligibilityReason[];
  readonly notices: AssessmentNotice[];
  readonly nextEligibilityDate: string | null;
  readonly origin: AssessmentSource;
  readonly assessedAt: Date;

  constructor(props: EligibilityAssessmentProps) {
    this.id = props.id;
    this.donorId = props.donorId;
    this.appointmentId = props.appointmentId;
    this.result = props.result;
    this.reasons = props.reasons;
    this.notices = props.notices ?? [];
    this.nextEligibilityDate = props.nextEligibilityDate;
    this.origin = props.origin;
    this.assessedAt = props.assessedAt;
  }
}
