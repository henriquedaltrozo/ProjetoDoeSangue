import { User } from '../../domain/entities/user';

export const USER_REPOSITORY = Symbol('UserRepository');

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findAdminById(id: string): Promise<User | null>;
  /** Admins ordenados do mais antigo para o mais novo. */
  listAdmins(): Promise<User[]>;
  countAdmins(): Promise<number>;
  countAdminsActive(): Promise<number>;
  /**
   * Serializa, até o fim da transação, as operações que dependem de quantos admins estão ativos:
   * dois admins desativando um ao outro ao mesmo tempo não podem deixar o sistema sem nenhum.
   */
  lockAdmins(): Promise<void>;
  /**
   * Doadores ativos criados antes de `createdBefore` que ainda não têm doador vinculado:
   * cadastros que ficaram no meio (falha ou queda entre os dois serviços).
   */
  listPendingDonors(createdBefore: Date, limit: number): Promise<User[]>;
  /** Insere ou atualiza (pelo id). */
  save(user: User): Promise<void>;
  /**
   * Grava só o controle de login (falhas seguidas, bloqueio e último acesso). O login lê o usuário e
   * espera o bcrypt antes de gravar: gravar o registro inteiro desfaria uma desativação ou troca de
   * senha feita nesse meio-tempo.
   */
  saveLoginState(user: User): Promise<void>;
  remove(id: string): Promise<void>;
}
