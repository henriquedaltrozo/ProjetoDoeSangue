import { type AppointmentOutput, toAppointmentOutput } from '../../dto';
import { Actor, requireOwnerOrAdmin } from '@shared/application/auth';
import { Role } from '@shared/domain/enums';
import { OutboxEvent } from '../../../domain/outbox';
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
import { AppointmentNotificationsService } from '../../services/appointment-notifications.service';
import { loadAppointmentOrFail } from '../shared/load-or-fail';

/**
 * Cancela um agendamento e remove as notificações pendentes. O doador cancela os próprios, antes do
 * horário e do check-in; o admin também depois deles (ver Appointment#cancel). O aviso de
 * cancelamento por e-mail vai pelo outbox, gravado na mesma transação do novo status.
 */
export class CancelAppointmentUseCase {
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

  async execute(id: string, user: Actor, reason?: string): Promise<AppointmentOutput> {
    const appointment = await loadAppointmentOrFail(this.appointments, id);
    requireOwnerOrAdmin(
      user,
      appointment.donorId,
      'Você só pode cancelar os próprios agendamentos.',
    );
    const byStaff = user.role === Role.ADMIN;
    appointment.cancel(this.clock.now(), byStaff, reason);
    const saved = await this.unitOfWork.run(async (tx) => {
      const updated = await tx.appointments.save(appointment);
      await tx.outbox.create(
        OutboxEvent.appointmentCanceled({
          appointmentId: updated.id,
          donorId: updated.donorId,
          collectionUnitId: updated.collectionUnitId,
          dateTime: updated.dateTime,
          reason: updated.cancellationReason,
          canceledByStaff: byStaff,
        }),
      );
      return updated;
    });
    await this.cache.invalidateDay(saved.collectionUnitId, saved.dateTime);
    await this.notifications.cancelPending(saved.id);
    return toAppointmentOutput(saved);
  }
}
