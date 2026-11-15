import type { NotificationJobPayload } from '@shared/application/messaging';
import { NotificationJobType } from '@shared/domain/enums';
import { NotificationDeliveryError } from '../errors';
import { TEMPLATE_CONTEXT, type TemplateContext } from '../ports/template-context.port';
import { UNSUBSCRIBE_LINKS, type UnsubscribeLinkBuilder } from '../ports/unsubscribe-links.port';
import { EmailNotifier } from '../services/email-notifier';
import {
  type NotificationMessage,
  composeAppointmentBooked,
  composeAppointmentCanceled,
  composeAttendanceConfirmation,
  composeEligibleAgain,
  composeEmailChanged,
  composeEmailVerification,
  composeIntervalCompleted,
  composeNoShow,
  composePasswordChanged,
  composeReminder24H,
  composeResetPassword,
  composeUrgentCampaign,
  composeWelcome,
} from '../templates/notification-templates';

/** Uma mensagem pronta para um destinatário (doador ou, nos avisos da conta, usuário). */
interface OutgoingEmail extends NotificationMessage {
  recipient: string;
  donorId?: string;
  userId?: string;
}

/**
 * Monta as mensagens de cada tipo de job: uma por destinatário. O `switch` sobre o discriminante
 * `type` obriga o compilador a cobrir todos os tipos de NotificationJobPayload.
 */
function composeEmails(
  payload: NotificationJobPayload,
  ctx: TemplateContext,
  unsubscribe: UnsubscribeLinkBuilder,
): OutgoingEmail[] {
  switch (payload.type) {
    case NotificationJobType.REMINDER_24H:
      return [
        {
          donorId: payload.donorId,
          recipient: payload.recipientEmail,
          ...composeReminder24H(payload, ctx),
        },
      ];
    case NotificationJobType.ATTENDANCE_CONFIRMATION:
      return [
        {
          donorId: payload.donorId,
          recipient: payload.recipientEmail,
          ...composeAttendanceConfirmation(payload),
        },
      ];
    case NotificationJobType.APPOINTMENT_BOOKED:
      return [
        {
          donorId: payload.donorId,
          recipient: payload.recipientEmail,
          ...composeAppointmentBooked(payload, ctx),
        },
      ];
    case NotificationJobType.APPOINTMENT_CANCELED:
      return [
        {
          donorId: payload.donorId,
          recipient: payload.recipientEmail,
          ...composeAppointmentCanceled(payload, ctx),
        },
      ];
    case NotificationJobType.INTERVAL_COMPLETED:
      return [
        {
          donorId: payload.donorId,
          recipient: payload.recipientEmail,
          ...composeIntervalCompleted(payload),
        },
      ];
    case NotificationJobType.NO_SHOW:
      return [
        {
          donorId: payload.donorId,
          recipient: payload.recipientEmail,
          ...composeNoShow(payload, ctx),
        },
      ];
    case NotificationJobType.EMAIL_VERIFICATION:
      return [
        {
          userId: payload.userId,
          recipient: payload.recipientEmail,
          ...composeEmailVerification(payload),
        },
      ];
    case NotificationJobType.WELCOME:
      return [
        {
          userId: payload.userId,
          donorId: payload.donorId,
          recipient: payload.recipientEmail,
          ...composeWelcome(payload, ctx),
        },
      ];
    case NotificationJobType.ELIGIBLE_AGAIN:
      return [
        {
          donorId: payload.donorId,
          recipient: payload.recipientEmail,
          ...composeEligibleAgain(payload, ctx, unsubscribe.forDonor(payload.donorId)),
        },
      ];
    case NotificationJobType.URGENT_CAMPAIGN:
      return payload.recipients.map((recipient) => ({
        donorId: recipient.donorId,
        recipient: recipient.recipientEmail,
        ...composeUrgentCampaign(
          payload,
          recipient.donorName,
          ctx,
          unsubscribe.forDonor(recipient.donorId),
        ),
      }));
    case NotificationJobType.RESET_PASSWORD:
      return [
        {
          userId: payload.userId,
          recipient: payload.recipientEmail,
          ...composeResetPassword(payload),
        },
      ];
    case NotificationJobType.PASSWORD_CHANGED:
      return [
        {
          userId: payload.userId,
          recipient: payload.recipientEmail,
          ...composePasswordChanged(payload, ctx),
        },
      ];
    case NotificationJobType.EMAIL_CHANGED:
      return [
        {
          userId: payload.userId,
          recipient: payload.recipientEmail,
          ...composeEmailChanged(payload, ctx),
        },
      ];
  }
}

/**
 * Processa um job da fila `notifications`: monta as mensagens do tipo do job e envia cada uma
 * (cada envio grava o seu NotificationLog, com sucesso ou falha). Se algum envio falhar, lança
 * NotificationDeliveryError para o BullMQ tentar o job de novo (com backoff, até o limite de
 * tentativas); nessa nova tentativa, só os destinatários que ainda não receberam são reenviados.
 */
export class DispatchNotificationUseCase {
  static readonly inject = [EmailNotifier, TEMPLATE_CONTEXT, UNSUBSCRIBE_LINKS] as const;

  constructor(
    private readonly notifier: EmailNotifier,
    private readonly ctx: TemplateContext,
    private readonly unsubscribe: UnsubscribeLinkBuilder,
  ) {}

  async execute(payload: NotificationJobPayload, jobId?: string): Promise<void> {
    const emails = composeEmails(payload, this.ctx, this.unsubscribe);
    let failures = 0;
    for (const email of emails) {
      if (!(await this.notifier.send({ ...email, type: payload.type, jobId }))) {
        failures += 1;
      }
    }
    if (failures > 0) {
      throw new NotificationDeliveryError(failures, emails.length);
    }
  }
}
