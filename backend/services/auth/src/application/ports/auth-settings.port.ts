export const AUTH_SETTINGS = Symbol('AuthSettings');

export interface AuthSettings {
  /** Validade do refresh token, em sufixo simples (30s, 15m, 1h, 7d). */
  readonly refreshTokenExpiresAt: string;
  /** URL base do frontend, usada no link do e-mail de redefinição. */
  readonly frontendUrl: string;
  /** Há provedor SMTP real configurado? */
  readonly smtpConfigured: boolean;
  /**
   * Rodando em produção (NODE_ENV=production)? Sem SMTP, o token de reset só volta na resposta da
   * API fora de produção; em produção ele vai apenas para o log do serviço.
   */
  readonly production: boolean;
}
