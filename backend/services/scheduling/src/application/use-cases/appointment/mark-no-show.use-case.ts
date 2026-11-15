import { type AppointmentOutput, toAppointmentOutput } from '../../dto';
import {
  APPOINTMENT_REPOSITORY,
  AVAILABILITY_CACHE,
  AppointmentRepository,
  AvailabilityCache,
  CLOCK,
  Clock,
  UNIT_OF_WORK,
  UnitOfWork,
} from '../../ports';
import { OutboxEvent } from '../../../domain/outbox';
import { AppointmentNotificationsService } from '../../services/appointment-notifications.service';
import { loadAppointmentOrFail } from '../shared/load-or-fail';

/**
 * [admin] Marca como não comparecido um agendamento esperado cujo horário já passou. O convite por
 * e-mail para reagendar vai pelo outbox, na mesma transação.
 */
export class MarkNoShowUseCase {
  static readonly inject = [
    APPOINTMENT_REPOSITORY,
    AVAILABILITY_CACHE,
    CLOCK,
    AppointmentNotificationsService,
    UNIT_OF_WORK,
  ] as const;

  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly cache: AvailabilityCache,
    private readonly clock: Clock,
    private readonly notifications: AppointmentNotificationsService,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(id: string): Promise<AppointmentOutput> {
    const appointment = await loadAppointmentOrFail(this.appointments, id);
    appointment.markNoShow(this.clock.now());
    const saved = await this.unitOfWork.run(async (tx) => {
      const updated = await tx.appointments.save(appointment);
      await tx.outbox.create(
        OutboxEvent.appointmentNoShow({
          appointmentId: updated.id,
          donorId: updated.donorId,
          collectionUnitId: updated.collectionUnitId,
          dateTime: updated.dateTime,
        }),
      );
      return updated;
    });
    await this.cache.invalidateDay(saved.collectionUnitId, saved.dateTime);
    await this.notifications.cancelPending(saved.id);
    return toAppointmentOutput(saved);
  }
}
