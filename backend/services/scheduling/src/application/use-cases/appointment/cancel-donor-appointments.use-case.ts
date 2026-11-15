import {
  APPOINTMENT_REPOSITORY,
  AVAILABILITY_CACHE,
  AppointmentRepository,
  AvailabilityCache,
  CLOCK,
  Clock,
} from '../../ports';
import { AppointmentNotificationsService } from '../../services/appointment-notifications.service';
import { AppointmentStatus } from '../../../domain/enums';

/** Motivo gravado nos agendamentos cancelados pela exclusão da conta. */
export const ACCOUNT_DELETION_REASON = 'Conta excluída a pedido do titular.';

const OPEN_STATES = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.ELIGIBILITY_CONFIRMED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKIN_PERFORMED,
];

/**
 * [interno] Cancela todos os agendamentos ainda não encerrados de um doador, libera as vagas e remove
 * os lembretes da fila (que levam nome e e-mail). Chamado pelo auth-service antes de anonimizar a
 * conta. Idempotente: repetir não muda nada. Devolve quantos foram cancelados.
 */
export class CancelDonorAppointmentsUseCase {
  static readonly inject = [
    APPOINTMENT_REPOSITORY,
    AVAILABILITY_CACHE,
    CLOCK,
    AppointmentNotificationsService,
  ] as const;

  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly cache: AvailabilityCache,
    private readonly clock: Clock,
    private readonly notifications: AppointmentNotificationsService,
  ) {}

  async execute(donorId: string): Promise<{ canceled: number }> {
    const open = (await this.appointments.listByDonor(donorId)).filter((a) =>
      OPEN_STATES.includes(a.status),
    );
    for (const appointment of open) {
      appointment.cancel(this.clock.now(), true, ACCOUNT_DELETION_REASON);
      const saved = await this.appointments.save(appointment);
      await this.cache.invalidateDay(saved.collectionUnitId, saved.dateTime);
      await this.notifications.cancelPending(saved.id);
    }
    return { canceled: open.length };
  }
}
