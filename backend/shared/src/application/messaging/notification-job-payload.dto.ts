import type { AssessmentNotice } from '../../domain/enums';
import { NotificationJobType } from '../../domain/enums';

export interface AppointmentReminderJobPayload {
  type: NotificationJobType.REMINDER_24H;
  appointmentId: string;
  donorId: string;
  donorName: string;
  recipientEmail: string;
  dateTime: string;
  collectionUnitName: string;
  /**
   * Link de confirmação de presença (com token embutido). Presente enquanto o
   * doador ainda não confirmou; vira `null` quando ele confirma antes do
   * lembrete sair (ver NotificationQueuePublisher#removeReminderLink24h, no scheduling),
   * e o e-mail passa a ser só um lembrete.
   */
  confirmationUrl?: string | null;
  /** Avisos da avaliação que o e-mail repete (ex.: levar o termo do responsável). */
  notices?: AssessmentNotice[];
}

/**
 * Pedido de confirmação de presença, enviado 48 h antes do agendamento
 * (ver CONFIRMATION_ADVANCE_HOURS no scheduling-service). `confirmationUrl`
 * já vem pronta, como em ResetPasswordJobPayload, para o notification-service
 * continuar "burro".
 */
export interface AttendanceConfirmationJobPayload {
  type: NotificationJobType.ATTENDANCE_CONFIRMATION;
  appointmentId: string;
  donorId: string;
  donorName: string;
  recipientEmail: string;
  dateTime: string;
  collectionUnitName: string;
  confirmationUrl: string;
  /** Avisos da avaliação que o e-mail repete (ex.: levar o termo do responsável). */
  notices?: AssessmentNotice[];
}

export interface IntervalCompletedJobPayload {
  type: NotificationJobType.INTERVAL_COMPLETED;
  /** Quando presente, o job usa um jobId determinístico (`interval-<id>`) e eventos repetidos viram um só e-mail. */
  appointmentId?: string;
  donorId: string;
  donorName: string;
  recipientEmail: string;
  nextEligibilityDate: string | null;
}

/**
 * Aviso de campanha urgente. O scheduling enfileira um job por doador (jobId `campaign-<id>-<doador>`):
 * cada e-mail tem a própria nova tentativa e o limite de envios por segundo vale por e-mail.
 */
export interface UrgentCampaignJobPayload {
  type: NotificationJobType.URGENT_CAMPAIGN;
  campaignId: string;
  title: string;
  message: string;
  recipients: Array<{ donorId: string; donorName: string; recipientEmail: string }>;
}

/** Aviso de segurança: a senha da conta foi trocada (vale para doador e admin). */
export interface PasswordChangedJobPayload {
  type: NotificationJobType.PASSWORD_CHANGED;
  userId: string;
  name: string;
  recipientEmail: string;
  /** Instante ISO 8601 da troca. */
  changedAt: string;
}

/** Aviso de segurança enviado ao endereço ANTIGO: o e-mail de acesso foi trocado por `newEmail`. */
export interface EmailChangedJobPayload {
  type: NotificationJobType.EMAIL_CHANGED;
  userId: string;
  name: string;
  /** O e-mail antigo, que deixou de ser o login. */
  recipientEmail: string;
  newEmail: string;
  /** Instante ISO 8601 da troca. */
  changedAt: string;
}

/** Confirmação do agendamento, enviada assim que a elegibilidade é confirmada. */
export interface AppointmentBookedJobPayload {
  type: NotificationJobType.APPOINTMENT_BOOKED;
  appointmentId: string;
  donorId: string;
  donorName: string;
  recipientEmail: string;
  dateTime: string;
  collectionUnitName: string;
  notices?: AssessmentNotice[];
}

/** Agendamento cancelado: pelo próprio doador, pela equipe ou pela desativação da unidade. */
export interface AppointmentCanceledJobPayload {
  type: NotificationJobType.APPOINTMENT_CANCELED;
  appointmentId: string;
  donorId: string;
  donorName: string;
  recipientEmail: string;
  dateTime: string;
  collectionUnitName: string;
  reason: string | null;
  /** Cancelado pela equipe (admin ou unidade desativada), e não pelo próprio doador. */
  canceledByStaff: boolean;
}

/** Boas-vindas ao concluir o cadastro de doador (vem do outbox do auth). */
export interface WelcomeJobPayload {
  type: NotificationJobType.WELCOME;
  userId: string;
  donorId: string;
  name: string;
  recipientEmail: string;
  /** Link para confirmar o e-mail (quem não confirmou ainda não pode agendar). */
  verificationUrl?: string;
}

/**
 * Link para confirmar o endereço de e-mail: reenvio do cadastro (`signup`) ou troca para um endereço
 * novo (`change`, enviado ao endereço novo; o login só muda quando ele for confirmado).
 */
export interface EmailVerificationJobPayload {
  type: NotificationJobType.EMAIL_VERIFICATION;
  userId: string;
  name: string;
  recipientEmail: string;
  verificationUrl: string;
  purpose: 'signup' | 'change';
  /** Validade do link, em horas. */
  expiresInHours: number;
}

/** O doador faltou ao agendamento (o admin marcou o não comparecimento). */
export interface NoShowJobPayload {
  type: NotificationJobType.NO_SHOW;
  appointmentId: string;
  donorId: string;
  donorName: string;
  recipientEmail: string;
  dateTime: string;
  collectionUnitName: string;
}

/** O doador voltou a poder doar hoje (fim do intervalo mínimo, do limite anual ou de uma inaptidão). */
export interface EligibleAgainJobPayload {
  type: NotificationJobType.ELIGIBLE_AGAIN;
  donorId: string;
  donorName: string;
  recipientEmail: string;
  /** AAAA-MM-DD do dia em que voltou a poder doar. */
  eligibleSince: string;
}

/**
 * Diferente dos outros jobs, não tem donorId - forgot-password vale para
 * qualquer User (doador OU admin), e o eligibility-service (onde vive o
 * cadastro de doadores) nem participa desse fluxo. `resetUrl` já vem pronta
 * do auth-service (com o token embutido) para o notification-service
 * continuar "burro", sem precisar conhecer as rotas do front.
 */
export interface ResetPasswordJobPayload {
  type: NotificationJobType.RESET_PASSWORD;
  userId: string;
  recipientEmail: string;
  resetUrl: string;
  expiresInMinutes: number;
}

/**
 * [LGPD] Pede ao notification-service que apague os dados pessoais (destinatário e texto) dos
 * e-mails já enviados a um titular que excluiu a conta. Não é uma notificação: não gera e-mail nem
 * entra no log, por isso o nome do job fica fora de NotificationJobType.
 */
export const ERASE_PERSONAL_DATA_JOB = 'erase-personal-data';

export interface ErasePersonalDataJobPayload {
  userId: string;
  donorId: string | null;
}

export type NotificationJobPayload =
  | AppointmentReminderJobPayload
  | AttendanceConfirmationJobPayload
  | IntervalCompletedJobPayload
  | UrgentCampaignJobPayload
  | ResetPasswordJobPayload
  | PasswordChangedJobPayload
  | EmailChangedJobPayload
  | AppointmentBookedJobPayload
  | AppointmentCanceledJobPayload
  | EligibleAgainJobPayload
  | WelcomeJobPayload
  | NoShowJobPayload
  | EmailVerificationJobPayload;
