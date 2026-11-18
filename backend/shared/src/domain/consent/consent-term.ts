/**
 * [LGPD] Termo de consentimento do cadastro. A versão vigente é gravada com o doador, para que se
 * saiba qual texto ele aceitou; o texto de cada versão fica em `docs/10-termo-consentimento.md`.
 * Ao mudar o texto, mude a versão: cadastros feitos com a versão anterior continuam com ela.
 */
export const CONSENT_TERM_VERSION = '2026-11-18';

/** Base legal (LGPD) que sustenta cada categoria de dado tratada pelo cadastro. */
export enum LegalBasis {
  /** Art. 7º, I: consentimento do titular (dados pessoais que não são de saúde). */
  PERSONAL_DATA_CONSENT = 'LGPD_ART_7_I',
  /** Art. 11, I: consentimento específico e destacado, para finalidade específica (dados de saúde). */
  HEALTH_DATA_CONSENT = 'LGPD_ART_11_I',
}
