import { Appointment } from '../../domain/appointment';
import { AppointmentStatus } from '../../domain/enums';
import { ConflictError } from '../errors';
import { APPOINTMENT_REPOSITORY, AppointmentRepository, CLOCK, Clock } from '../ports';
import { AppointmentNotificationsService } from './appointment-notifications.service';

/**
 * Passo comum às duas formas de confirmar presença (logado ou por token):
 * aplica a transição de domínio (idempotente), grava e limpa as pendências da fila.
 */
export class AttendanceConfirmationService {
  static readonly inject = [
    APPOINTMENT_REPOSITORY,
    CLOCK,
    AppointmentNotificationsService,
  ] as const;

  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly clock: Clock,
    private readonly notifications: AppointmentNotificationsService,
  ) {}

  async apply(appointment: Appointment): Promise<Appointment> {
    if (!appointment.confirmAttendance(this.clock.now())) {
      return appointment;
    }
    let saved: Appointment;
    try {
      saved = await this.appointments.save(appointment);
    } catch (err) {
      // Duas confirmações ao mesmo tempo (ex.: duplo clique no link): se a outra já confirmou,
      // o resultado é o mesmo e a operação continua idempotente; qualquer outra mudança é conflito.
      const current =
        err instanceof ConflictError && (await this.appointments.findById(appointment.id));
      if (current && current.status === AppointmentStatus.CONFIRMED) return current;
      throw err;
    }
    await this.notifications.clearPendingConfirmations(saved.id);
    return saved;
  }
}
