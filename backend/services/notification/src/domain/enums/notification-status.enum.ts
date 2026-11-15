export enum NotificationStatus {
  SENT = 'SENT',
  FAILURE = 'FAILURE',
  /** Não enviado: o endereço está bloqueado (devolveu e-mail ou marcou como spam). */
  SUPPRESSED = 'SUPPRESSED',
}
