import { APPOINTMENT_REPOSITORY, AppointmentRepository, CLOCK, Clock } from '../../ports';

/**
 * [interno] Dos doadores informados, quais têm um agendamento em aberto (mesma regra de
 * Appointment#isOpenForDonor). Usado pelo eligibility-service para não mandar o "você já pode
 * doar" a quem já agendou.
 */
export class FindDonorsWithOpenAppointmentUseCase {
  static readonly inject = [APPOINTMENT_REPOSITORY, CLOCK] as const;

  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly clock: Clock,
  ) {}

  execute(donorIds: string[]): Promise<string[]> {
    if (donorIds.length === 0) return Promise.resolve([]);
    return this.appointments.donorsWithOpenAppointment([...new Set(donorIds)], this.clock.now());
  }
}
