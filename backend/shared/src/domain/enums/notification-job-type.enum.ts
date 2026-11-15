/** Tipo de notificação (conceito de domínio, gravado no NotificationLog); também nomeia o job na fila e roteia o processor. */
export enum NotificationJobType {
  REMINDER_24H = 'reminder-24h',
  ATTENDANCE_CONFIRMATION = 'attendance-confirmation',
  URGENT_CAMPAIGN = 'urgent-campaign',
  INTERVAL_COMPLETED = 'interval-completed',
  RESET_PASSWORD = 'reset-password',
  /** Aviso de segurança: a senha da conta foi trocada. */
  PASSWORD_CHANGED = 'password-changed',
  /** Aviso de segurança, para o endereço antigo: o e-mail de acesso da conta foi trocado. */
  EMAIL_CHANGED = 'email-changed',
  /** Agendamento criado e com a elegibilidade confirmada. */
  APPOINTMENT_BOOKED = 'appointment-booked',
  /** Agendamento cancelado (pelo doador, pela equipe ou pela desativação da unidade). */
  APPOINTMENT_CANCELED = 'appointment-canceled',
  /** O doador voltou a poder doar (fim do intervalo, do limite anual ou de uma inaptidão). */
  ELIGIBLE_AGAIN = 'eligible-again',
  /** Boas-vindas ao concluir o cadastro de doador, com os próximos passos. */
  WELCOME = 'welcome',
  /** O doador faltou ao agendamento: convite para marcar outro horário. */
  NO_SHOW = 'no-show',
  /** Link para confirmar o endereço de e-mail (reenvio, ou troca para um endereço novo). */
  EMAIL_VERIFICATION = 'email-verification',
}
