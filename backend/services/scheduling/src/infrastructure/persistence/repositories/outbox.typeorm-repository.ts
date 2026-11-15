import { AppointmentStatus } from '../../../domain/enums';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThanOrEqual, Repository } from 'typeorm';
import { CompletionWithoutEvent, OutboxRepository } from '../../../application/ports';
import { NewOutboxEvent, OutboxEvent, OutboxStatus } from '../../../domain/outbox';
import { OutboxEventMapper } from '../mappers/outbox-event.mapper';
import { OutboxEventOrmEntity } from '../orm-entities/outbox-event.orm-entity';

@Injectable()
export class OutboxTypeOrmRepository implements OutboxRepository {
  constructor(
    @InjectRepository(OutboxEventOrmEntity) private readonly repo: Repository<OutboxEventOrmEntity>,
  ) {}

  async create(draft: NewOutboxEvent): Promise<OutboxEvent> {
    const saved = await this.repo.save(OutboxEventMapper.newToOrm(draft));
    return OutboxEventMapper.toDomain(saved);
  }

  async save(event: OutboxEvent): Promise<OutboxEvent> {
    const saved = await this.repo.save(OutboxEventMapper.toOrm(event));
    return OutboxEventMapper.toDomain(saved);
  }

  async claimPending(limit: number, leaseUntil: Date): Promise<OutboxEvent[]> {
    const table = this.repo.metadata.tablePath
      .split('.')
      .map((part) => `"${part}"`)
      .join('.');
    // Um único comando: seleciona e trava (SKIP LOCKED) e já adia o vencimento; o commit é imediato.
    const output = await this.repo.query(
      `UPDATE ${table} SET "nextAttemptAt" = $1
        WHERE id IN (
          SELECT id FROM ${table}
           WHERE status = $2 AND "nextAttemptAt" <= now()
           ORDER BY "createdAt" ASC
           LIMIT $3
           FOR UPDATE SKIP LOCKED)
        RETURNING *`,
      [leaseUntil, OutboxStatus.PENDING, limit],
    );
    // No Postgres, o TypeORM devolve [linhas, quantidade] para UPDATE.
    const rows = (Array.isArray(output[0]) ? output[0] : output) as OutboxEventOrmEntity[];
    return rows
      .map((row) => OutboxEventMapper.toDomain(this.repo.create(row)))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async listFailures(limit: number): Promise<OutboxEvent[]> {
    const events = await this.repo.find({
      where: { status: OutboxStatus.FAILURE },
      order: { createdAt: 'ASC' },
      take: limit,
    });
    return events.map(OutboxEventMapper.toDomain);
  }

  async findFailureById(id: string): Promise<OutboxEvent | null> {
    const orm = await this.repo.findOne({ where: { id, status: OutboxStatus.FAILURE } });
    return orm ? OutboxEventMapper.toDomain(orm) : null;
  }

  async reactivateFailuresExpired(maxReprocessings: number): Promise<number> {
    const result = await this.repo
      .createQueryBuilder()
      .update(OutboxEventOrmEntity)
      .set({
        status: OutboxStatus.PENDING,
        attempts: 0,
        nextAttemptAt: () => 'now()',
        reprocessings: () => '"reprocessings" + 1',
      })
      .where('status = :status', { status: OutboxStatus.FAILURE })
      .andWhere('"nextAttemptAt" <= now()')
      .andWhere('"reprocessings" < :max', { max: maxReprocessings })
      .execute();
    return result.affected ?? 0;
  }

  countPermanentFailures(maxReprocessings: number): Promise<number> {
    return this.repo.count({
      where: {
        status: OutboxStatus.FAILURE,
        reprocessings: MoreThanOrEqual(maxReprocessings),
      },
    });
  }

  async purgeProcessed(before: Date): Promise<number> {
    const result = await this.repo.delete({
      status: OutboxStatus.PROCESSED,
      processedAt: LessThan(before),
    });
    return result.affected ?? 0;
  }

  async findFirstEventDate(): Promise<Date | null> {
    const first = await this.repo
      .createQueryBuilder('e')
      .select('MIN(e.createdAt)', 'min')
      .getRawOne<{ min: Date | null }>();
    return first?.min ?? null;
  }

  async listCompletionsWithoutEvent(
    since: Date,
    windowDays: number,
  ): Promise<CompletionWithoutEvent[]> {
    const lines: { id: string; donorId: string; completedAt: Date; dateTime: Date }[] =
      await this.repo.manager.query(
        `SELECT a.id, a."donorId", a."completedAt", a."dateTime"
           FROM scheduling.appointments a
          WHERE a.status = $1
            AND a."completedAt" >= GREATEST($2::timestamptz, now() - make_interval(days => $3))
            AND NOT EXISTS (
              SELECT 1 FROM scheduling.outbox_events o WHERE o.payload->>'appointmentId' = a.id::text
            )`,
        [AppointmentStatus.COMPLETED, since, windowDays],
      );
    return lines.map((l) => ({
      appointmentId: l.id,
      donorId: l.donorId,
      completedAt: new Date(l.completedAt),
      appointmentDateTime: new Date(l.dateTime),
    }));
  }
}
