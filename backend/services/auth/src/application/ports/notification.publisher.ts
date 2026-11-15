import type { AccountNoticePayload } from './account-notice-outbox';

export const NOTIFICATION_PUBLISHER = Symbol('NotificationPublisher');

export interface ResetPasswordNotification {
  userId: string;
  recipientEmail: string;
  resetUrl: string;
  expiresInMinutes: number;
}

export interface NotificationPublisher {
  enqueueResetPassword(notification: ResetPasswordNotification): Promise<void>;
  /**
   * Aviso de segurança da conta (senha ou e-mail alterado), vindo do outbox. `jobId` fixo por aviso:
   * repetir a entrega não gera um segundo e-mail.
   */
  enqueueAccountNotice(payload: AccountNoticePayload, jobId: string): Promise<void>;
  /**
   * [LGPD] Pede ao notification-service que apague destinatário e texto dos e-mails já enviados ao
   * titular. Idempotente (um job por usuário).
   */
  enqueueErasePersonalData(userId: string, donorId: string | null): Promise<void>;
}
