export const CONFIRMATION_TOKEN_SERVICE = Symbol('CONFIRMATION_TOKEN_SERVICE');

/** Token assinado do link de confirmação de presença, independente do login. */
export interface ConfirmationTokenService {
  /** Monta o link completo do front que recebe o token. */
  buildUrl(appointmentId: string, dateTime: Date): string;
  /**
   * Devolve o id do agendamento. Lança InvalidEntryError se o token for
   * malformado ou a assinatura não bater, e ExpiredError se já expirou.
   */
  verify(token: string): string;
}
