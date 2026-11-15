/** Nome e e-mail que o auth-service repassa ao eligibility-service quando o usuário os troca. */
export interface UpdateDonorIdentityInput {
  completeName?: string;
  email?: string;
  /** O doador confirmou o endereço de e-mail (pelo link enviado pelo auth-service). */
  emailVerified?: boolean;
}
