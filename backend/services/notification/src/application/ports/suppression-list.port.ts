export const SUPPRESSION_LIST = Symbol('SUPPRESSION_LIST');

/** Um endereço bloqueado e por quê. */
export interface SuppressedRecipient {
  email: string;
  /** Evento do provedor que causou o bloqueio (ex.: hard_bounce, spam). */
  reason: string;
  createdAt: Date;
}

/**
 * Endereços que não recebem mais e-mail: devolveram (endereço inexistente) ou marcaram como spam,
 * segundo os eventos do provedor (ver RegisterMailEventsUseCase). Comparação sem diferenciar
 * maiúsculas. Um admin pode desbloquear (ex.: o doador corrigiu a caixa de entrada).
 */
export interface SuppressionList {
  /** Motivo do bloqueio, ou null se o endereço pode receber. */
  reasonFor(email: string): Promise<string | null>;
  /** Bloqueia (ou atualiza o motivo de) um endereço. */
  add(email: string, reason: string): Promise<void>;
  remove(email: string): Promise<boolean>;
  /** Mais recentes primeiro. */
  list(limit: number): Promise<SuppressedRecipient[]>;
}
