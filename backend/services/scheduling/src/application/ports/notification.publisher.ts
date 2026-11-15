import {
  AppointmentBookedJobPayload,
  AppointmentCanceledJobPayload,
  NoShowJobPayload,
  UrgentCampaignJobPayload,
  AttendanceConfirmationJobPayload,
  IntervalCompletedJobPayload,
  AppointmentReminderJobPayload,
} from '@shared/application/messaging';

export const NOTIFICATION_PUBLISHER = Symbol('NOTIFICATION_PUBLISHER');

/** Fila de notificações assíncronas (e-mails): o worker só envia o que já vem resolvido no payload. */
export interface NotificationPublisher {
  enqueueReminder24H(payload: AppointmentReminderJobPayload, delayMs: number): Promise<void>;
  enqueueAttendanceConfirmation(
    payload: AttendanceConfirmationJobPayload,
    delayMs: number,
  ): Promise<void>;
  enqueueIntervalCompleted(payload: IntervalCompletedJobPayload): Promise<void>;
  /** Confirmação do agendamento (sai na hora; um por agendamento). */
  enqueueAppointmentBooked(payload: AppointmentBookedJobPayload): Promise<void>;
  /** Aviso de cancelamento (sai na hora; um por agendamento). */
  enqueueAppointmentCanceled(payload: AppointmentCanceledJobPayload): Promise<void>;
  /** Convite para reagendar após a falta (um por agendamento). */
  enqueueNoShow(payload: NoShowJobPayload): Promise<void>;
  enqueueUrgentCampaign(payload: UrgentCampaignJobPayload): Promise<void>;
  cancelReminder24H(appointmentId: string): Promise<void>;
  cancelAttendanceConfirmation(appointmentId: string): Promise<void>;
  /** O lembrete já enfileirado deixa de pedir a confirmação e vira só um lembrete. */
  removeReminderLink24h(appointmentId: string): Promise<void>;
}
