/**
 * Avisos que acompanham uma avaliação APTA: não impedem a doação, mas o doador precisa saber
 * deles antes de ir ao hemocentro.
 */
export enum AssessmentNotice {
  /** Menor de 18 anos: levar o termo de consentimento assinado pelo responsável legal. */
  BRING_GUARDIAN_CONSENT = 'BRING_GUARDIAN_CONSENT',
}
