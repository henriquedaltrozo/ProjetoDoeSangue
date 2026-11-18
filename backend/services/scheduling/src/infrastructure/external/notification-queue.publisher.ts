import {
  AppointmentBookedJobPayload,
  AppointmentCanceledJobPayload,
  AppointmentReminderJobPayload,
  NoShowJobPayload,
  AttendanceConfirmationJobPayload,
  IntervalCompletedJobPayload,
  NOTIFICATIONS_QUEUE_NAME,
  UrgentCampaignJobPayload,
} from '@shared/application/messaging';
import { NotificationJobType } from '@shared/domain/enums';
import { DEFAULT_JOB_OPTIONS } from '@shared/infrastructure/messaging';
import { openJson, sealJson } from '@shared/infrastructure/persistence';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { NotificationPublisher } from '../../application/ports';

/**
 * Publica na fila `notifications` (consumida pelo notification-service). O conteúdo já vai resolvido
 * (nome, e-mail, link com token) e cifrado, para o worker não precisar chamar outros serviços. Lembrete e
 * pedido de confirmação têm jobId fixo por agendamento, para poderem ser cancelados ou atualizados.
 */
@Injectable()
export class NotificationQueuePublisher implements NotificationPublisher {
  private readonly logger = new Logger(NotificationQueuePublisher.name);

  constructor(@InjectQueue(NOTIFICATIONS_QUEUE_NAME) private readonly queue: Queue) {}

  async enqueueReminder24H(payload: AppointmentReminderJobPayload, delayMs: number): Promise<void> {
    const delay = Math.max(delayMs, 0);
    await this.queue.add(NotificationJobType.REMINDER_24H, sealJson(payload), {
      delay,
      jobId: reminderJobId(payload.appointmentId),
      ...DEFAULT_JOB_OPTIONS,
    });
    this.logger.log(
      `Lembrete 24h agendado para o agendamento ${payload.appointmentId} (delay ${delay}ms)`,
    );
  }

  /** Pedido de confirmação de presença (48 h antes - ver CONFIRMATION_ADVANCE_HOURS). */
  async enqueueAttendanceConfirmation(
    payload: AttendanceConfirmationJobPayload,
    delayMs: number,
  ): Promise<void> {
    const delay = Math.max(delayMs, 0);
    await this.queue.add(NotificationJobType.ATTENDANCE_CONFIRMATION, sealJson(payload), {
      delay,
      jobId: confirmationJobId(payload.appointmentId),
      ...DEFAULT_JOB_OPTIONS,
    });
    this.logger.log(
      `Pedido de confirmação agendado para o agendamento ${payload.appointmentId} (delay ${delay}ms)`,
    );
  }

  async enqueueIntervalCompleted(payload: IntervalCompletedJobPayload): Promise<void> {
    await this.queue.add(NotificationJobType.INTERVAL_COMPLETED, sealJson(payload), {
      ...DEFAULT_JOB_OPTIONS,
      // Entrega "pelo menos uma vez" do outbox: com jobId fixo por agendamento, repetições do
      // mesmo evento não geram um segundo e-mail (os concluídos ficam 7 dias para valer a regra).
      ...(payload.appointmentId
        ? {
            jobId: `interval-${payload.appointmentId}`,
            removeOnComplete: { age: 7 * 24 * 3600 },
          }
        : {}),
    });
  }

  /** jobId fixo por agendamento: repetir não gera um segundo e-mail. */
  async enqueueAppointmentBooked(payload: AppointmentBookedJobPayload): Promise<void> {
    await this.queue.add(NotificationJobType.APPOINTMENT_BOOKED, sealJson(payload), {
      ...DEFAULT_JOB_OPTIONS,
      jobId: `booked-${payload.appointmentId}`,
      removeOnComplete: { age: 7 * 24 * 3600 },
    });
  }

  /** jobId fixo por agendamento: o evento do outbox pode repetir sem gerar um segundo e-mail. */
  async enqueueAppointmentCanceled(payload: AppointmentCanceledJobPayload): Promise<void> {
    await this.queue.add(NotificationJobType.APPOINTMENT_CANCELED, sealJson(payload), {
      ...DEFAULT_JOB_OPTIONS,
      jobId: `canceled-${payload.appointmentId}`,
      removeOnComplete: { age: 7 * 24 * 3600 },
    });
    // A confirmação do agendamento, se ainda estiver na fila, já não faz sentido.
    await (await this.queue.getJob(`booked-${payload.appointmentId}`))?.remove();
  }

  /** jobId fixo por agendamento: o evento do outbox pode repetir sem gerar um segundo e-mail. */
  async enqueueNoShow(payload: NoShowJobPayload): Promise<void> {
    await this.queue.add(NotificationJobType.NO_SHOW, sealJson(payload), {
      ...DEFAULT_JOB_OPTIONS,
      jobId: `no-show-${payload.appointmentId}`,
      removeOnComplete: { age: 7 * 24 * 3600 },
    });
  }

  /**
   * Um job por doador (jobId `campaign-<campanha>-<doador>`): cada e-mail tem a própria nova
   * tentativa, o limite de envios por segundo do worker vale por e-mail, e o evento do outbox pode
   * repetir sem gerar um segundo aviso a ninguém.
   */
  async enqueueUrgentCampaign(payload: UrgentCampaignJobPayload): Promise<void> {
    await this.queue.addBulk(
      payload.recipients.map((recipient) => ({
        name: NotificationJobType.URGENT_CAMPAIGN,
        data: sealJson({ ...payload, recipients: [recipient] }),
        opts: {
          ...DEFAULT_JOB_OPTIONS,
          jobId: `campaign-${payload.campaignId}-${recipient.donorId}`,
          removeOnComplete: { age: 7 * 24 * 3600 },
        },
      })),
    );
  }

  /** Cancela um lembrete de 24h já enfileirado (ex.: agendamento cancelado antes de disparar). */
  async cancelReminder24H(appointmentId: string): Promise<void> {
    await (await this.queue.getJob(reminderJobId(appointmentId)))?.remove();
  }

  /** Cancela o pedido de confirmação ainda não enviado (agendamento cancelado ou já confirmado). */
  async cancelAttendanceConfirmation(appointmentId: string): Promise<void> {
    await (await this.queue.getJob(confirmationJobId(appointmentId)))?.remove();
  }

  /**
   * Depois que o doador confirma, o lembrete de 24 h (se ainda não saiu) deixa de pedir a
   * confirmação e vira só um lembrete. Atualiza os dados do job no lugar, sem removê-lo, para não
   * perder o agendamento do delay.
   */
  async removeReminderLink24h(appointmentId: string): Promise<void> {
    const job = await this.queue.getJob(reminderJobId(appointmentId));
    if (job) {
      await job.updateData(
        sealJson({ ...openJson<Record<string, unknown>>(job.data), confirmationUrl: null }),
      );
    }
  }
}

const reminderJobId = (appointmentId: string) => `reminder-${appointmentId}`;
const confirmationJobId = (appointmentId: string) => `confirmation-${appointmentId}`;
