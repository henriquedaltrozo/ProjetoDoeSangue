import { type CollectionUnitOutput, toCollectionUnitOutput } from '../../dto';
import {
  APPOINTMENT_REPOSITORY,
  AVAILABILITY_CACHE,
  AppointmentRepository,
  AvailabilityCache,
  CLOCK,
  COLLECTION_UNIT_REPOSITORY,
  Clock,
  CollectionUnitRepository,
  UNIT_OF_WORK,
  UnitOfWork,
} from '../../ports';
import { OutboxEvent } from '../../../domain/outbox';
import { AppointmentNotificationsService } from '../../services/appointment-notifications.service';
import { loadCollectionUnitOrFail } from '../shared/load-or-fail';

/** Motivo gravado nos agendamentos cancelados pela desativação da unidade. */
export const UNIT_DEACTIVATED_REASON = 'Unidade de coleta desativada.';

/**
 * [admin] Desativa uma unidade de coleta e cancela os agendamentos dela que ainda podem acontecer
 * (sem check-in, de hoje em diante - inclusive os de hoje com horário já passado, porque o check-in
 * vale o dia todo): os doadores veriam o agendamento confirmado num lugar fechado. Os lembretes saem
 * da fila e o doador vê o agendamento cancelado, com o motivo, na lista dele. Os agendamentos já
 * encerrados ficam como estão (histórico).
 */
export class DeactivateCollectionUnitUseCase {
  static readonly inject = [
    COLLECTION_UNIT_REPOSITORY,
    APPOINTMENT_REPOSITORY,
    AVAILABILITY_CACHE,
    CLOCK,
    AppointmentNotificationsService,
    UNIT_OF_WORK,
  ] as const;

  constructor(
    private readonly units: CollectionUnitRepository,
    private readonly appointments: AppointmentRepository,
    private readonly cache: AvailabilityCache,
    private readonly clock: Clock,
    private readonly notifications: AppointmentNotificationsService,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(id: string): Promise<CollectionUnitOutput> {
    const unit = await loadCollectionUnitOrFail(this.units, id);
    unit.deactivate();
    const saved = await this.units.save(unit);

    const now = this.clock.now();
    // Só os que ainda podem acontecer (antes do check-in, de hoje em diante), sem carregar o histórico.
    const upcoming = await this.appointments.listUpcomingByUnit(id, now);
    for (const appointment of upcoming) {
      appointment.cancel(now, true, UNIT_DEACTIVATED_REASON);
      // O doador é avisado por e-mail (outbox, na mesma transação do cancelamento).
      const canceled = await this.unitOfWork.run(async (tx) => {
        const updated = await tx.appointments.save(appointment);
        await tx.outbox.create(
          OutboxEvent.appointmentCanceled({
            appointmentId: updated.id,
            donorId: updated.donorId,
            collectionUnitId: updated.collectionUnitId,
            dateTime: updated.dateTime,
            reason: UNIT_DEACTIVATED_REASON,
            canceledByStaff: true,
          }),
        );
        return updated;
      });
      await this.cache.invalidateDay(canceled.collectionUnitId, canceled.dateTime);
      await this.notifications.cancelPending(canceled.id);
    }
    return toCollectionUnitOutput(saved);
  }
}
