import { CONFIRMATION_ADVANCE_HOURS, REMINDER_ADVANCE_HOURS } from './appointments.constants';

const MS_BY_HOUR = 3_600_000;

export interface NotificationWindow {
  /** Atraso do lembrete (24 h antes); zero ou negativo significa "sai na hora". */
  delayReminderMs: number;
  /** Atraso do pedido de confirmação (48 h antes); zero ou negativo significa "sai na hora". */
  delayConfirmationMs: number;
  /** Se o pedido de confirmação deve ser enfileirado além do lembrete. */
  sendConfirmationRequest: boolean;
}

/**
 * Regras de quando notificar o doador de um agendamento com elegibilidade confirmada:
 * - lembrete 24 h antes (sempre), que traz o link de confirmação enquanto o
 *   doador não confirmar;
 * - pedido de confirmação 48 h antes, só quando ainda dá tempo (mais de 24 h
 *   de antecedência). Se faltar entre 24 h e 48 h, o pedido sai na hora; se
 *   faltar menos de 24 h, o lembrete (que já sai na hora) leva o link e não
 *   se manda um segundo e-mail.
 */
export function calculateNotificationWindow(dateTime: Date, now: Date): NotificationWindow {
  const msUntilDonation = dateTime.getTime() - now.getTime();
  const delayReminderMs = msUntilDonation - REMINDER_ADVANCE_HOURS * MS_BY_HOUR;
  const delayConfirmationMs = msUntilDonation - CONFIRMATION_ADVANCE_HOURS * MS_BY_HOUR;
  return { delayReminderMs, delayConfirmationMs, sendConfirmationRequest: delayReminderMs > 0 };
}
