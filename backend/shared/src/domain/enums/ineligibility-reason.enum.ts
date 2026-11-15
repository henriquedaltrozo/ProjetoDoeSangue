/**
 * Códigos usados no array `reasons` (jsonb) de EligibilityAssessment: um por regra do motor de
 * elegibilidade (ver eligibility-service, domain/services/assess-eligibility.ts).
 */
export enum IneligibilityReason {
  MIN_INTERVAL_NOT_FULFILLED = 'MIN_INTERVAL_NOT_FULFILLED',
  AGE_BELOW_MIN = 'AGE_BELOW_MIN',
  AGE_ABOVE_MAX = 'AGE_ABOVE_MAX',
  AGE_ABOVE_MAX_FIRST_DONATION = 'AGE_ABOVE_MAX_FIRST_DONATION',
  /** 16 ou 17 anos sem o responsável legal informado e o termo de consentimento confirmado. */
  GUARDIAN_CONSENT_REQUIRED = 'GUARDIAN_CONSENT_REQUIRED',
  /** 70 anos ou mais, doador regular, ainda sem avaliação médica favorável registrada. */
  MEDICAL_CLEARANCE_REQUIRED = 'MEDICAL_CLEARANCE_REQUIRED',
  MAX_ANNUAL_DONATIONS_REACHED = 'MAX_ANNUAL_DONATIONS_REACHED',
  INSUFFICIENT_WEIGHT = 'INSUFFICIENT_WEIGHT',
  ACTIVE_TEMPORARY_UNFITNESS = 'ACTIVE_TEMPORARY_UNFITNESS',
  PERMANENT_UNFIT = 'PERMANENT_UNFIT',
}
