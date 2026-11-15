import { AssessmentSource, NotificationJobType } from '@shared/domain/enums';
import { toBusinessDate } from '@shared/domain/time';
import {
  AppointmentCanceledPayload,
  AppointmentConfirmedPayload,
  AppointmentNoShowPayload,
  DonationCompletedPayload,
  OUTBOX_BATCH,
  OUTBOX_LEASE_MS,
  OutboxEvent,
  OutboxStatus,
  OutboxEventType,
  UrgentCampaignCreatedPayload,
} from '../../../domain/outbox';
import { AppointmentNotificationsService } from '../../services/appointment-notifications.service';
import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
  CAMPAIGN_REPOSITORY,
  CampaignRepository,
  CLOCK,
  Clock,
  COLLECTION_UNIT_REPOSITORY,
  CollectionUnitRepository,
  ELIGIBILITY_GATEWAY,
  EligibilityGateway,
  LOGGER,
  LoggerPort,
  NOTIFICATION_PUBLISHER,
  NotificationPublisher,
  OUTBOX_REPOSITORY,
  OutboxRepository,
} from '../../ports';
import { UnknownEventTypeError } from '../../errors';

/**
 * Despachante do outbox: reserva um lote de eventos pendentes (operação atômica, com SKIP LOCKED,
 * que já termina a transação) e só então executa o handler de cada um, gravando o resultado evento
 * a evento. Assim nenhuma conexão nem lock do banco fica preso enquanto as chamadas HTTP rodam.
 * Handlers precisam ser idempotentes (entrega at-least-once): um lote cuja instância caiu volta
 * a ser processado quando a reserva vence.
 */
export class DispatchOutboxUseCase {
  private running = false;

  static readonly inject = [
    OUTBOX_REPOSITORY,
    CAMPAIGN_REPOSITORY,
    ELIGIBILITY_GATEWAY,
    NOTIFICATION_PUBLISHER,
    CLOCK,
    LOGGER,
    COLLECTION_UNIT_REPOSITORY,
    APPOINTMENT_REPOSITORY,
    AppointmentNotificationsService,
  ] as const;

  constructor(
    private readonly outbox: OutboxRepository,
    private readonly campaigns: CampaignRepository,
    private readonly eligibility: EligibilityGateway,
    private readonly publisher: NotificationPublisher,
    private readonly clock: Clock,
    private readonly logger: LoggerPort,
    private readonly units: CollectionUnitRepository,
    private readonly appointments: AppointmentRepository,
    private readonly notifications: AppointmentNotificationsService,
  ) {}

  /** Processa um lote; retorna quantos eventos foram tratados. */
  async execute(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const leaseUntil = new Date(this.clock.now().getTime() + OUTBOX_LEASE_MS);
      const events = await this.outbox.claimPending(OUTBOX_BATCH, leaseUntil);
      for (const event of events) {
        await this.handle(event);
        await this.outbox.save(event);
      }
      return events.length;
    } catch (err) {
      this.logger.error(
        `Falha ao processar outbox: ${(err as Error).message}`,
        DispatchOutboxUseCase.name,
      );
      return 0;
    } finally {
      this.running = false;
    }
  }

  /** Executa o handler e atualiza o estado do evento (sem persistir). */
  async handle(event: OutboxEvent): Promise<void> {
    try {
      await this.runHandler(event);
      event.registerSuccess(this.clock.now());
    } catch (err) {
      event.registerFailure((err as Error).message, this.clock.now());
      if (event.status === OutboxStatus.FAILURE) {
        this.logger.error(
          `ALERT: evento ${event.id} (${event.type}) esgotou as tentativas: ${event.lastError}`,
          DispatchOutboxUseCase.name,
        );
      } else {
        this.logger.warn(
          `Evento ${event.id} falhou (tentativa ${event.attempts}): ${event.lastError}`,
          DispatchOutboxUseCase.name,
        );
      }
    }
  }

  private async runHandler(event: OutboxEvent): Promise<void> {
    switch (event.type) {
      case OutboxEventType.DONATION_COMPLETED:
        return this.onCompleteDonation(event.payload as DonationCompletedPayload);
      case OutboxEventType.URGENT_CAMPAIGN_CREATED:
        return this.onUrgentCampaign(event.payload as UrgentCampaignCreatedPayload);
      case OutboxEventType.APPOINTMENT_CANCELED:
        return this.onAppointmentCanceled(event.payload as AppointmentCanceledPayload);
      case OutboxEventType.APPOINTMENT_CONFIRMED:
        return this.onAppointmentConfirmed(event.payload as AppointmentConfirmedPayload);
      case OutboxEventType.APPOINTMENT_NO_SHOW:
        return this.onNoShow(event.payload as AppointmentNoShowPayload);
      default:
        throw new UnknownEventTypeError(event.type);
    }
  }

  /** Idempotente: repetir o evento só reaplica a mesma data e reenfileira o mesmo jobId. */
  private async onCompleteDonation({
    appointmentId,
    donorId,
    donationDate,
  }: DonationCompletedPayload): Promise<void> {
    const donor = await this.eligibility.completeDonation(donorId, donationDate);
    // Com o agendamento, o eligibility devolve a mesma avaliação se o evento se repetir.
    const assessment = await this.eligibility.assessInternal({
      donorId,
      origin: AssessmentSource.POST_DONATION,
      appointmentId,
    });
    await this.publisher.enqueueIntervalCompleted({
      type: NotificationJobType.INTERVAL_COMPLETED,
      appointmentId,
      donorId,
      donorName: donor.completeName,
      recipientEmail: donor.email,
      nextEligibilityDate: assessment.nextEligibilityDate,
    });
  }

  /**
   * Agenda os e-mails do agendamento confirmado. Confere o agendamento no momento do envio: se ele
   * foi cancelado (ou o horário passou) enquanto o evento esperava, não agenda nada. Idempotente
   * (jobIds fixos por agendamento).
   */
  private async onAppointmentConfirmed({
    appointmentId,
  }: AppointmentConfirmedPayload): Promise<void> {
    const appointment = await this.appointments.findById(appointmentId);
    if (!appointment?.awaitsAttendance()) return;
    if (appointment.dateTime.getTime() <= this.clock.now().getTime()) return;
    const donor = await this.eligibility.findDonorContact(appointment.donorId);
    if (!donor?.active) return;
    const unit = await this.units.findById(appointment.collectionUnitId);
    await this.notifications.schedule(appointment, unit?.name ?? 'unidade de coleta', donor);
  }

  /** Convida o doador que faltou a reagendar. Idempotente (jobId fixo por agendamento). */
  private async onNoShow(payload: AppointmentNoShowPayload): Promise<void> {
    const donor = await this.eligibility.findDonorContact(payload.donorId);
    if (!donor?.active) return;
    const unit = await this.units.findById(payload.collectionUnitId);
    await this.publisher.enqueueNoShow({
      type: NotificationJobType.NO_SHOW,
      appointmentId: payload.appointmentId,
      donorId: payload.donorId,
      donorName: donor.completeName,
      recipientEmail: donor.email,
      dateTime: payload.dateTime,
      collectionUnitName: unit?.name ?? 'unidade de coleta',
    });
  }

  /**
   * Garante que o lembrete e o pedido de confirmação saíram da fila e avisa o doador do
   * cancelamento. O caso de uso já tenta tirá-los da fila na hora (melhor esforço); aqui, uma falha
   * reagenda o evento, então um agendamento cancelado nunca fica com lembrete pendente. Idempotente
   * (jobId fixo por agendamento). Doador excluído (anonimizado) ou inexistente não tem a quem avisar.
   */
  private async onAppointmentCanceled(payload: AppointmentCanceledPayload): Promise<void> {
    await this.publisher.cancelReminder24H(payload.appointmentId);
    await this.publisher.cancelAttendanceConfirmation(payload.appointmentId);
    const donor = await this.eligibility.findDonorContact(payload.donorId);
    if (!donor?.active) return;
    const unit = await this.units.findById(payload.collectionUnitId);
    await this.publisher.enqueueAppointmentCanceled({
      type: NotificationJobType.APPOINTMENT_CANCELED,
      appointmentId: payload.appointmentId,
      donorId: payload.donorId,
      donorName: donor.completeName,
      recipientEmail: donor.email,
      dateTime: payload.dateTime,
      collectionUnitName: unit?.name ?? 'unidade de coleta',
      reason: payload.reason,
      canceledByStaff: payload.canceledByStaff,
    });
  }

  /**
   * Avisa os doadores aptos sobre uma campanha urgente. Idempotente: o job tem jobId fixo por
   * campanha, então repetir o evento não gera um segundo aviso. Campanha já desativada ou encerrada
   * (evento reprocessado tarde) não avisa.
   */
  private async onUrgentCampaign({ campaignId }: UrgentCampaignCreatedPayload): Promise<void> {
    const campaign = await this.campaigns.findById(campaignId);
    if (!campaign?.active || campaign.hasEnded(toBusinessDate(this.clock.now()))) return;
    const contacts = await this.eligibility.listContactsByBloodType(
      campaign.targetBloodType ?? undefined,
    );
    if (contacts.length === 0) return;
    await this.publisher.enqueueUrgentCampaign({
      type: NotificationJobType.URGENT_CAMPAIGN,
      campaignId: campaign.id,
      title: campaign.title,
      message: campaign.description,
      recipients: contacts.map((c) => ({
        donorId: c.id,
        donorName: c.completeName,
        recipientEmail: c.email,
      })),
    });
  }
}
