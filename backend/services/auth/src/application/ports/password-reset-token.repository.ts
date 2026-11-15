import { PasswordResetToken } from '../../domain/entities/password-reset-token';

export const PASSWORD_RESET_TOKEN_REPOSITORY = Symbol('PasswordResetTokenRepository');

export interface PasswordResetTokenRepository {
  findByHash(tokenHash: string): Promise<PasswordResetToken | null>;
  save(token: PasswordResetToken): Promise<void>;
  /**
   * Marca o token como usado só se ainda não foi, numa operação atômica. Devolve `true` se foi esta
   * chamada que o consumiu; `false` se outra requisição o usou antes.
   */
  consumeIfUnused(tokenId: string, when: Date): Promise<boolean>;
  /** Marca como usados todos os tokens de redefinição pendentes do usuário. */
  invalidateUserPending(userId: string, when: Date): Promise<void>;
  /** Apaga os tokens vencidos antes de `before`. */
  purgeExpired(before: Date): Promise<number>;
}
