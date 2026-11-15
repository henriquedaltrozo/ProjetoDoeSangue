export const EMAIL_VERIFICATION_TOKENS = Symbol('EmailVerificationTokens');

/** O que o link de confirmação prova: que quem o abriu recebeu e-mail neste endereço. */
export interface EmailVerificationClaims {
  userId: string;
  email: string;
}

/** Token assinado do link "confirme seu e-mail" (sem estado: a validade vai dentro dele). */
export interface EmailVerificationTokens {
  generate(claims: EmailVerificationClaims, expiresAt: Date): string;
  /** As afirmações do token; 'expired' se passou da validade; null se inválido ou adulterado. */
  verify(token: string, now: Date): EmailVerificationClaims | 'expired' | null;
}
