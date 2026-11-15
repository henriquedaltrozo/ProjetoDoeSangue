export const UNSUBSCRIBE_TOKENS = Symbol('UNSUBSCRIBE_TOKENS');

/** Confere o token do link "não quero mais receber estes avisos" (gerado pelo notification-service). */
export interface UnsubscribeTokens {
  /** Id do doador, ou null se o token for inválido. */
  verify(token: string): string | null;
}
