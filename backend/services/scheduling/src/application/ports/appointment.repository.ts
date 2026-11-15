import { AppointmentStatus } from '../../domain/enums';
import { Appointment, NewAppointment, OccupancyByTime } from '../../domain/appointment';

export const APPOINTMENT_REPOSITORY = Symbol('APPOINTMENT_REPOSITORY');

export interface AppointmentsFilter {
  status?: AppointmentStatus;
  collectionUnitId?: string;
  /** Intervalo (inclusive) em que `dateTime` deve cair. */
  period?: { start: Date; end: Date };
}

export interface AppointmentRepository {
  create(draft: NewAppointment): Promise<Appointment>;
  /** Grava as mudanças de estado; lança ConflictError se o agendamento mudou desde que foi lido. */
  save(appointment: Appointment): Promise<Appointment>;
  remove(id: string): Promise<void>;
  findById(id: string): Promise<Appointment | null>;
  listByDonor(donorId: string): Promise<Appointment[]>;
  /** Mais recentes primeiro, até ADMIN_LIST_LIMIT agendamentos. */
  list(filter: AppointmentsFilter): Promise<Appointment[]>;
  /**
   * Agendamentos da unidade que ainda podem acontecer: antes do check-in e de hoje (dia de Brasília)
   * em diante. Os de hoje com o horário já passado entram: o check-in vale o dia todo.
   */
  listUpcomingByUnit(collectionUnitId: string, now: Date): Promise<Appointment[]>;
  /** Quantos agendamentos que ocupam vaga existem na unidade, exatamente neste horário. */
  countOccupied(collectionUnitId: string, dateTime: Date): Promise<number>;
  /** Vagas ocupadas por horário dentro do intervalo. */
  countOccupancyByTime(
    collectionUnitId: string,
    start: Date,
    end: Date,
  ): Promise<OccupancyByTime[]>;
  /**
   * Trava o par unidade+horário até o fim da transação corrente, serializando
   * a checagem de vagas e a reserva (evita overbooking sob concorrência).
   * Só tem efeito dentro de uma transação aberta pela UnitOfWork.
   */
  blockTime(collectionUnitId: string, dateTime: Date): Promise<void>;
  /**
   * Trava o doador até o fim da transação: serializa a checagem "já tem agendamento em aberto?" e a
   * reserva, para dois pedidos simultâneos do mesmo doador não passarem os dois.
   */
  blockDonor(donorId: string): Promise<void>;
  /** Quantos agendamentos em aberto o doador tem (ver Appointment#isOpenForDonor). */
  countOpenByDonor(donorId: string, now: Date): Promise<number>;
  /** Dos doadores informados, os que têm agendamento em aberto (mesma regra de countOpenByDonor). */
  donorsWithOpenAppointment(donorIds: string[], now: Date): Promise<string[]>;
}
