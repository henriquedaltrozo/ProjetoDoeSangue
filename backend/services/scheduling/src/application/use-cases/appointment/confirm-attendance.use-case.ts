import { type AppointmentOutput, toAppointmentOutput } from '../../dto';
import { Actor, requireOwnerOrAdmin } from '@shared/application/auth';
import { APPOINTMENT_REPOSITORY, AppointmentRepository } from '../../ports';
import { AttendanceConfirmationService } from '../../services/attendance-confirmation.service';
import { loadAppointmentOrFail } from '../shared/load-or-fail';

/**
 * Confirma a presença de quem está autenticado: o próprio doador, ou um admin
 * em nome dele (ex.: depois de ligar para o doador que não respondeu ao
 * e-mail). ELIGIBILITY_CONFIRMED -> CONFIRMED, idempotente.
 */
export class ConfirmAttendanceUseCase {
  static readonly inject = [APPOINTMENT_REPOSITORY, AttendanceConfirmationService] as const;

  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly confirmation: AttendanceConfirmationService,
  ) {}

  async execute(id: string, user: Actor): Promise<AppointmentOutput> {
    const appointment = await loadAppointmentOrFail(this.appointments, id);
    requireOwnerOrAdmin(
      user,
      appointment.donorId,
      'Você só pode confirmar presença nos próprios agendamentos.',
    );
    return toAppointmentOutput(await this.confirmation.apply(appointment));
  }
}
