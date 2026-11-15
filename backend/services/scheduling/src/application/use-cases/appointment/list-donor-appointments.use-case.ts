import { type AppointmentOutput, toAppointmentOutput } from '../../dto';
import { APPOINTMENT_REPOSITORY, AppointmentRepository } from '../../ports';

/** Histórico de agendamentos de um doador, do mais recente ao mais antigo. */
export class ListDonorAppointmentsUseCase {
  static readonly inject = [APPOINTMENT_REPOSITORY] as const;

  constructor(private readonly appointments: AppointmentRepository) {}

  /**
   * Sem doador (ex.: um admin chamando GET /appointments/me), não há o que listar. Sem esta checagem,
   * o filtro `donorId: undefined` seria ignorado pelo TypeORM e devolveria todos os agendamentos.
   */
  async execute(donorId: string | null | undefined): Promise<AppointmentOutput[]> {
    if (!donorId) return [];
    return (await this.appointments.listByDonor(donorId)).map(toAppointmentOutput);
  }
}
