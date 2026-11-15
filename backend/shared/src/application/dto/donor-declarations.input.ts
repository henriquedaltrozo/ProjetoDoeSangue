/**
 * Informações que o próprio doador declara, porque o sistema não tem o histórico dele: o que é
 * obrigatório depende da idade (o eligibility-service valida no cadastro).
 */
export interface DonorDeclarationsInput {
  /** Menores de 18 anos: nome do responsável legal. */
  guardianName?: string;
  /** Menores de 18 anos: confirma que apresentará o termo de consentimento assinado pelo responsável. */
  guardianConsent?: boolean;
  /** 60 anos ou mais: já doou sangue antes dos 60 anos. */
  donatedBefore60?: boolean;
  /** 70 anos ou mais: declara ser doador voluntário regular. */
  regularDonor?: boolean;
  /** Data (AAAA-MM-DD) da última doação de sangue, para quem já doou. */
  lastDonationDate?: string;
}
