import type {
  EmailChangedJobPayload,
  EmailVerificationJobPayload,
  PasswordChangedJobPayload,
  WelcomeJobPayload,
} from '@shared/application/messaging';

export const ACCOUNT_NOTICE_OUTBOX = Symbol('AccountNoticeOutbox');

/**
 * Aviso da conta (boas-vindas, confirmação de e-mail, senha ou e-mail alterado), já no formato do job
 * da fila. Os que levam o link de confirmação guardam o token aqui só até a entrega (o registro é
 * apagado em seguida).
 */
export type AccountNoticePayload =
  | PasswordChangedJobPayload
  | EmailChangedJobPayload
  | WelcomeJobPayload
  | EmailVerificationJobPayload;

/** Aviso ainda não entregue à fila. */
export interface PendingAccountNotice {
  id: string;
  payload: AccountNoticePayload;
  attempts: number;
  createdAt: Date;
}

/**
 * Outbox dos avisos de segurança da conta: o aviso é gravado na mesma transação da mudança (troca
 * de senha ou de e-mail) e um despachante o entrega à fila depois, com novas tentativas. Assim, a
 * fila fora do ar não faz o aviso se perder. Entregue, o registro é apagado (ele guarda nome e
 * e-mail, dado pessoal).
 */
export interface AccountNoticeOutbox {
  add(payload: AccountNoticePayload): Promise<void>;
  /**
   * Reserva, numa operação atômica, até `limit` avisos vencidos e adia o vencimento deles para
   * `leaseUntil` (outra instância não pega os mesmos; se quem reservou cair, voltam depois).
   */
  claimDue(limit: number, leaseUntil: Date): Promise<PendingAccountNotice[]>;
  /** Aviso entregue à fila (ou descartado): apaga o registro. */
  remove(id: string): Promise<void>;
  /** Falhou: conta a tentativa e marca quando tentar de novo. */
  reschedule(id: string, attempts: number, nextAttemptAt: Date, lastError: string): Promise<void>;
}
