import { NotificationJobType } from '@shared/domain/enums';
import { Appointment, calculateNotificationWindow } from '../../domain/appointment';
import { AppointmentStatus } from '../../domain/enums';
import {
  CLOCK,
  CONFIRMATION_TOKEN_SERVICE,
  Clock,
  ConfirmationTokenService,
  LOGGER,
  LoggerPort,
  NOTIFICATION_PUBLISHER,
  NotificationPublisher,
} from '../ports';

const CONTEXT = 'AppointmentNotifications';

/** Orquestra as notificações assíncronas ligadas ao ciclo de vida de um agendamento. */
export class AppointmentNotificationsService {
  static readonly inject = [
    NOTIFICATION_PUBLISHER,
    CONFIRMATION_TOKEN_SERVICE,
    CLOCK,
    LOGGER,
  ] as const;

  constructor(
    private readonly publisher: NotificationPublisher,
    private readonly tokens: ConfirmationTokenService,
    private readonly clock: Clock,
    private readonly logger: LoggerPort,
  ) {}

  /**
   * Enfileira as notificações do agendamento confirmado pela elegibilidade: a confirmação do
   * agendamento (na hora), o lembrete 24 h antes e, quando ainda dá tempo, o pedido de confirmação
   * 48 h antes - ver calculateNotificationWindow. Chamado pelo despachante do outbox (evento
   * APPOINTMENT_CONFIRMED): uma falha propaga e o evento é tentado de novo. Repetir é seguro (jobIds
   * fixos por agendamento). Se o doador já confirmou a presença, o lembrete sai sem o link e não há
   * pedido de confirmação.
   */
  async schedule(
    appointment: Appointment,
    unitName: string,
    donor: { completeName: string; email: string },
  ): Promise<void> {
    const window = calculateNotificationWindow(appointment.dateTime, this.clock.now());
    const pending = appointment.status !== AppointmentStatus.CONFIRMED;
    const confirmationUrl = pending
      ? this.tokens.buildUrl(appointment.id, appointment.dateTime)
      : null;
    const base = {
      appointmentId: appointment.id,
      donorId: appointment.donorId,
      donorName: donor.completeName,
      recipientEmail: donor.email,
      dateTime: appointment.dateTime.toISOString(),
      collectionUnitName: unitName,
      notices: appointment.eligibilityNotices,
    };

    await this.publisher.enqueueAppointmentBooked({
      type: NotificationJobType.APPOINTMENT_BOOKED,
      ...base,
    });
    await this.publisher.enqueueReminder24H(
      { type: NotificationJobType.REMINDER_24H, ...base, confirmationUrl },
      window.delayReminderMs,
    );
    if (confirmationUrl && window.sendConfirmationRequest) {
      await this.publisher.enqueueAttendanceConfirmation(
        { type: NotificationJobType.ATTENDANCE_CONFIRMATION, ...base, confirmationUrl },
        window.delayConfirmationMs,
      );
    }
  }

  /**
   * Remove o lembrete e o pedido de confirmação ainda pendentes (agendamento cancelado ou faltoso).
   * Melhor esforço: o novo status já foi gravado e é o fato principal; uma falha na fila não pode
   * transformar a operação em erro para o usuário. Fica no log; no cancelamento, o evento do outbox
   * tenta remover de novo até conseguir (ver DispatchOutboxUseCase).
   */
  async cancelPending(appointmentId: string): Promise<void> {
    try {
      await this.publisher.cancelReminder24H(appointmentId);
      await this.publisher.cancelAttendanceConfirmation(appointmentId);
    } catch (err) {
      this.logger.error(
        `Falha ao cancelar notificações pendentes do agendamento ${appointmentId}: ${(err as Error).message}`,
        CONTEXT,
      );
    }
  }

  /**
   * Melhor esforço: a confirmação já foi gravada e é o fato principal - uma
   * falha ao mexer na fila só significa que o doador pode receber um e-mail a
   * mais, e é só registrada.
   */
  async clearPendingConfirmations(appointmentId: string): Promise<void> {
    try {
      await this.publisher.cancelAttendanceConfirmation(appointmentId);
      await this.publisher.removeReminderLink24h(appointmentId);
    } catch (err) {
      this.logger.error(
        `Falha ao limpar notificações pendentes do agendamento ${appointmentId}: ${(err as Error).message}`,
        CONTEXT,
      );
    }
  }
}
