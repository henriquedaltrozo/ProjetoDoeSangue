import type { AccountNoticeOutbox } from './account-notice-outbox';
import { PasswordResetTokenRepository } from './password-reset-token.repository';
import { RefreshTokenRepository } from './refresh-token.repository';
import { UserRepository } from './user.repository';

export const UNIT_OF_WORK = Symbol('AuthUnitOfWork');

/** Repositórios ligados à transação corrente: tudo que passar por eles é confirmado (ou desfeito) junto. */
export interface TransactionalContext {
  users: UserRepository;
  refreshTokens: RefreshTokenRepository;
  resetTokens: PasswordResetTokenRepository;
  /** Avisos de segurança gravados junto com a mudança que os origina. */
  accountNotices: AccountNoticeOutbox;
}

export interface UnitOfWork {
  /** Executa o trabalho numa transação; qualquer erro lançado desfaz tudo. */
  run<T>(work: (tx: TransactionalContext) => Promise<T>): Promise<T>;
}
