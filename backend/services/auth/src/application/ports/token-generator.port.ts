export const TOKEN_GENERATOR = Symbol('TokenGenerator');

/** Geração e hash dos tokens opacos (refresh e redefinição de senha). */
export interface TokenGenerator {
  generateRefreshToken(): string;
  generateResetToken(): string;
  hash(token: string): string;
}
