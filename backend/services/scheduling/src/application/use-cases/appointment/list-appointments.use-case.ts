import { type AppointmentOutput, toAppointmentOutput } from '../../dto';
import { AppointmentStatus } from '../../../domain/enums';
import { dayInterval } from '../../../domain/appointment';
import { APPOINTMENT_REPOSITORY, AppointmentRepository } from '../../ports';

export interface ListAppointmentsCommand {
  status?: AppointmentStatus;
  collectionUnitId?: string;
  /** Dia (AAAA-MM-DD) no horário de Brasília. */
  date?: string;
}

/**
 * [admin] Lista agendamentos com filtros opcionais - usado pelo painel admin
 * para localizar agendamentos e fazer check-in/conclusão sem precisar já saber
 * o id de antemão.
 */
export class ListAppointmentsUseCase {
  static readonly inject = [APPOINTMENT_REPOSITORY] as const;

  constructor(private readonly appointments: AppointmentRepository) {}

  async execute(filter: ListAppointmentsCommand): Promise<AppointmentOutput[]> {
    return (
      await this.appointments.list({
        status: filter.status,
        collectionUnitId: filter.collectionUnitId,
        period: filter.date ? dayInterval(filter.date) : undefined,
      })
    ).map(toAppointmentOutput);
  }
}
