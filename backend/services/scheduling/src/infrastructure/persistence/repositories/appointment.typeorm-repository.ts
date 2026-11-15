import { businessDayInterval, toBusinessDate } from '@shared/domain/time';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ADMIN_LIST_LIMIT,
  Appointment,
  SLOT_OCCUPYING_STATES,
  NewAppointment,
  OccupancyByTime,
} from '../../../domain/appointment';
import { ConflictError } from '../../../application/errors';
import { AppointmentStatus } from '../../../domain/enums';
import { AppointmentRepository, AppointmentsFilter } from '../../../application/ports';
import { AppointmentMapper } from '../mappers/appointment.mapper';
import { AppointmentOrmEntity } from '../orm-entities/appointment.orm-entity';

@Injectable()
export class AppointmentTypeOrmRepository implements AppointmentRepository {
  constructor(
    @InjectRepository(AppointmentOrmEntity) private readonly repo: Repository<AppointmentOrmEntity>,
  ) {}

  async create(draft: NewAppointment): Promise<Appointment> {
    const saved = await this.repo.save(AppointmentMapper.newToOrm(draft));
    return AppointmentMapper.toDomain(saved);
  }

  /**
   * Concorrência otimista: só grava se a versão no banco ainda é a que foi lida. Se outra operação
   * alterou o agendamento nesse meio-tempo (ex.: cancelar e fazer check-in ao mesmo tempo), nada é
   * gravado e o caso de uso recebe um ConflictError, em vez de sobrescrever a outra alteração.
   * Só os campos que as transições de estado mudam são atualizados.
   */
  async save(appointment: Appointment): Promise<Appointment> {
    const result = await this.repo.update(
      { id: appointment.id, version: appointment.version },
      {
        status: appointment.status,
        assessmentEligibilityId: appointment.assessmentEligibilityId,
        eligibilityNotices: appointment.eligibilityNotices,
        cancellationReason: appointment.cancellationReason,
        confirmedAt: appointment.confirmedAt,
        checkinAt: appointment.checkinAt,
        completedAt: appointment.completedAt,
        version: appointment.version + 1,
      },
    );
    if (result.affected !== 1) {
      throw new ConflictError(
        'O agendamento foi alterado por outra operação. Recarregue e tente de novo.',
      );
    }
    const saved = await this.repo.findOneOrFail({ where: { id: appointment.id } });
    return AppointmentMapper.toDomain(saved);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  async findById(id: string): Promise<Appointment | null> {
    const orm = await this.repo.findOne({ where: { id } });
    return orm ? AppointmentMapper.toDomain(orm) : null;
  }

  async listByDonor(donorId: string): Promise<Appointment[]> {
    const list = await this.repo.find({ where: { donorId }, order: { dateTime: 'DESC' } });
    return list.map(AppointmentMapper.toDomain);
  }

  async list(filter: AppointmentsFilter): Promise<Appointment[]> {
    const query = this.repo.createQueryBuilder('a').orderBy('a.dateTime', 'DESC');

    if (filter.status) {
      query.andWhere('a.status = :status', { status: filter.status });
    }
    if (filter.collectionUnitId) {
      query.andWhere('a.collectionUnitId = :collectionUnitId', {
        collectionUnitId: filter.collectionUnitId,
      });
    }
    if (filter.period) {
      query.andWhere('a.dateTime BETWEEN :start AND :end', filter.period);
    }

    return (await query.take(ADMIN_LIST_LIMIT).getMany()).map(AppointmentMapper.toDomain);
  }

  async listUpcomingByUnit(collectionUnitId: string, now: Date): Promise<Appointment[]> {
    const list = await this.repo
      .createQueryBuilder('a')
      .where('a.collectionUnitId = :collectionUnitId', { collectionUnitId })
      .andWhere('a.dateTime >= :startOfToday', {
        startOfToday: businessDayInterval(toBusinessDate(now)).start,
      })
      .andWhere('a.status IN (:...states)', {
        states: [
          AppointmentStatus.SCHEDULED,
          AppointmentStatus.ELIGIBILITY_CONFIRMED,
          AppointmentStatus.CONFIRMED,
        ],
      })
      .orderBy('a.dateTime', 'ASC')
      .getMany();
    return list.map(AppointmentMapper.toDomain);
  }

  countOccupied(collectionUnitId: string, dateTime: Date): Promise<number> {
    return this.repo
      .createQueryBuilder('a')
      .where('a.collectionUnitId = :collectionUnitId', { collectionUnitId })
      .andWhere('a.dateTime = :dateTime', { dateTime })
      .andWhere('a.status IN (:...states)', { states: SLOT_OCCUPYING_STATES })
      .getCount();
  }

  async countOccupancyByTime(
    collectionUnitId: string,
    start: Date,
    end: Date,
  ): Promise<OccupancyByTime[]> {
    const lines = await this.repo
      .createQueryBuilder('a')
      .select('a.dateTime', 'dateTime')
      .addSelect('COUNT(*)', 'occupied')
      .where('a.collectionUnitId = :collectionUnitId', { collectionUnitId })
      .andWhere('a.dateTime BETWEEN :start AND :end', { start, end })
      .andWhere('a.status IN (:...states)', { states: SLOT_OCCUPYING_STATES })
      .groupBy('a.dateTime')
      .getRawMany<{ dateTime: Date; occupied: string }>();
    return lines.map((l) => ({ dateTime: new Date(l.dateTime), occupied: Number(l.occupied) }));
  }

  /**
   * Advisory lock do Postgres escopado à transação (liberado automaticamente
   * no commit/rollback), serializando checagem+reserva do par unidade/horário
   * (ver observação de design em docs/01, seção 5.3).
   */
  async blockTime(collectionUnitId: string, dateTime: Date): Promise<void> {
    const lockKey = `${collectionUnitId}:${dateTime.toISOString()}`;
    await this.repo.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey]);
  }

  /** Mesmo mecanismo de `blockTime`, com uma chave por doador. */
  async blockDonor(donorId: string): Promise<void> {
    await this.repo.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`donor:${donorId}`]);
  }

  /** Mesma regra de Appointment#isOpenForDonor: os que esperam check-in contam até o fim do dia. */
  countOpenByDonor(donorId: string, now: Date): Promise<number> {
    return this.openQuery(now).andWhere('a.donorId = :donorId', { donorId }).getCount();
  }

  async donorsWithOpenAppointment(donorIds: string[], now: Date): Promise<string[]> {
    if (donorIds.length === 0) return [];
    const rows = await this.openQuery(now)
      .andWhere('a.donorId IN (:...donorIds)', { donorIds })
      .select('DISTINCT a.donorId', 'donorId')
      .getRawMany<{ donorId: string }>();
    return rows.map((r) => r.donorId);
  }

  /** Agendamentos em aberto: com check-in feito, ou à espera dele de hoje (dia de Brasília) em diante. */
  private openQuery(now: Date) {
    const startOfToday = businessDayInterval(toBusinessDate(now)).start;
    return this.repo
      .createQueryBuilder('a')
      .where(
        '(a.status = :checkin OR (a.status IN (:...waiting) AND a.dateTime >= :startOfToday))',
        {
          checkin: AppointmentStatus.CHECKIN_PERFORMED,
          waiting: [
            AppointmentStatus.SCHEDULED,
            AppointmentStatus.ELIGIBILITY_CONFIRMED,
            AppointmentStatus.CONFIRMED,
          ],
          startOfToday,
        },
      );
  }
}
