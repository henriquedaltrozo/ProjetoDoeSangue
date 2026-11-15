import { RefreshToken } from '../../domain/entities/refresh-token';

export const REFRESH_TOKEN_REPOSITORY = Symbol('RefreshTokenRepository');

export interface RefreshTokenRepository {
  findByHash(tokenHash: string): Promise<RefreshToken | null>;
  save(token: RefreshToken): Promise<void>;
  /**
   * Revoga o token só se ainda estiver ativo, numa única operação atômica. Devolve `true` se foi
   * esta chamada que o revogou; `false` se outra requisição chegou antes (rotação concorrente).
   */
  revokeIfActive(tokenId: string, when: Date): Promise<boolean>;
  /** Revoga o token do usuário identificado pelo hash (usado no logout). */
  revokeByHash(userId: string, tokenHash: string, when: Date): Promise<void>;
  /**
   * Encerra todas as sessões do usuário apagando os tokens dele, inclusive os já revogados. Assim um
   * cookie antigo apresentado depois (ex.: de outro aparelho, após a troca de senha) só não é
   * encontrado, em vez de parecer reuso de token roubado e derrubar também a sessão nova.
   */
  deleteUserTokens(userId: string): Promise<void>;
  /** Apaga os tokens vencidos antes de `before` (já não servem nem para detectar reuso). */
  purgeExpired(before: Date): Promise<number>;
}
