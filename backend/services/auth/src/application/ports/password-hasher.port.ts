export const PASSWORD_HASHER = Symbol('PasswordHasher');

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  /**
   * Compara a senha com o hash. Com `hash` nulo (conta inexistente) compara
   * contra um hash falso, para o tempo de resposta não revelar se a conta existe.
   */
  verify(password: string, hash: string | null): Promise<boolean>;
}
