import type {
  AssessmentNotice,
  AssessmentSource,
  EligibilityResult,
  IneligibilityReason,
} from '@shared/domain/enums';
import type { EligibilityAssessmentOutput, EligibilityCheckOutput } from '../../../application/dto';

/** Representação HTTP de uma avaliação de elegibilidade. */
export interface AssessmentResponse {
  id: string;
  donorId: string;
  appointmentId: string | null;
  result: EligibilityResult;
  reasons: IneligibilityReason[];
  notices: AssessmentNotice[];
  nextEligibilityDate: string | null;
  origin: AssessmentSource;
  assessedAt: string;
}

/** Resposta da consulta do doador (não gravada, sem id). */
export type CheckResponse = Omit<AssessmentResponse, 'id' | 'appointmentId'>;

export function toCheckResponse(c: EligibilityCheckOutput): CheckResponse {
  return {
    donorId: c.donorId,
    result: c.result,
    reasons: [...c.reasons],
    notices: [...c.notices],
    nextEligibilityDate: c.nextEligibilityDate,
    origin: c.origin,
    assessedAt: c.assessedAt.toISOString(),
  };
}

export function toAssessmentResponse(a: EligibilityAssessmentOutput): AssessmentResponse {
  return {
    id: a.id,
    donorId: a.donorId,
    appointmentId: a.appointmentId,
    result: a.result,
    reasons: [...a.reasons],
    notices: [...a.notices],
    nextEligibilityDate: a.nextEligibilityDate,
    origin: a.origin,
    assessedAt: a.assessedAt.toISOString(),
  };
}
