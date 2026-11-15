import type { DonorDataExportOutput } from '../../../application/dto';
import { type AssessmentResponse, toAssessmentResponse } from './assessment.presenter';
import { type DonorResponse, toDonorResponse } from './donor.presenter';
import { type UnfitnessResponse, toUnfitnessResponse } from './unfitness.presenter';

/** Representação HTTP da exportação de dados do doador (portabilidade, LGPD). */
export interface DataExportResponse {
  donor: DonorResponse;
  temporaryUnfitness: UnfitnessResponse[];
  eligibilityAssessments: AssessmentResponse[];
}

export function toDataExportResponse(exported: DonorDataExportOutput): DataExportResponse {
  return {
    donor: toDonorResponse(exported.donor),
    temporaryUnfitness: exported.temporaryUnfitness.map(toUnfitnessResponse),
    eligibilityAssessments: exported.eligibilityAssessments.map(toAssessmentResponse),
  };
}
