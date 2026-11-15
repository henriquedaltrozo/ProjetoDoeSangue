export const TOKEN_REVOCATION = Symbol('TOKEN_REVOCATION');

/**
 * Revogação dos tokens de acesso (JWT) de um usuário antes de expirarem: depois de desativar um
 * admin, excluir uma conta ou trocar a senha, os tokens emitidos até ali deixam de valer em todos os
 * serviços, sem esperar os 15 minutos de validade.
 */
export interface TokenRevocation {
  /** Invalida os tokens de acesso do usuário emitidos até `at`. */
  revokeUser(userId: string, at: Date): Promise<void>;
  /** Instante (em segundos, como o `iat` do JWT) da última revogação do usuário, ou null. */
  revokedAtSeconds(userId: string): Promise<number | null>;
}
