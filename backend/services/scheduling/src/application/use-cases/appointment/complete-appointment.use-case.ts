import { type AppointmentOutput, toAppointmentOutput } from '../../dto';
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
import { loadAppointmentOrFail } from '../shared/load-or-fail';

/** [admin] Conclui a doação (CHECKIN_PERFORMED -> COMPLETED) e registra o evento da pós-doação. */
export class CompleteAppointmentUseCase {
  static readonly inject = [
    APPOINTMENT_REPOSITORY,
    UNIT_OF_WORK,
    AVAILABILITY_CACHE,
    CLOCK,
  ] as const;

  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly cache: AvailabilityCache,
    private readonly clock: Clock,
  ) {}

  async execute(id: string): Promise<AppointmentOutput> {
    const appointment = await loadAppointmentOrFail(this.appointments, id);
    const now = this.clock.now();
    appointment.complete(now);

    // Outbox transacional: o status e o evento da pós-doação (atualizar o
    // cadastro do doador e notificar) são gravados juntos; o despachante
    // reexecuta com backoff até dar certo.
    const saved = await this.unitOfWork.run(async (tx) => {
      const updated = await tx.appointments.save(appointment);
      await tx.outbox.create(
        OutboxEvent.donationCompleted({
          appointmentId: updated.id,
          donorId: updated.donorId,
          appointmentDateTime: updated.dateTime,
        }),
      );
      return updated;
    });
    await this.cache.invalidateDay(saved.collectionUnitId, saved.dateTime);

    return toAppointmentOutput(saved);
  }
}
