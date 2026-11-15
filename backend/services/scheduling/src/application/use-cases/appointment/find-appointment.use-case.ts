import { type AppointmentOutput, toAppointmentOutput } from '../../dto';
import { Actor, requireOwnerOrAdmin } from '@shared/application/auth';
import { APPOINTMENT_REPOSITORY, AppointmentRepository } from '../../ports';
import { loadAppointmentOrFail } from '../shared/load-or-fail';

export class FindAppointmentUseCase {
  static readonly inject = [APPOINTMENT_REPOSITORY] as const;

  constructor(private readonly appointments: AppointmentRepository) {}

  async execute(id: string, actor: Actor): Promise<AppointmentOutput> {
    const appointment = await loadAppointmentOrFail(this.appointments, id);
    requireOwnerOrAdmin(actor, appointment.donorId);
    return toAppointmentOutput(appointment);
  }
}
