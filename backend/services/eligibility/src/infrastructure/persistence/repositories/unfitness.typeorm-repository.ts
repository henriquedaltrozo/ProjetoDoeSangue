import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { UnfitnessRepository } from '../../../application/ports/unfitness.repository';
import {
  type NewTemporaryUnfitness,
  TemporaryUnfitness,
} from '../../../domain/entities/temporary-unfitness';
import { TemporaryUnfitnessMapper } from '../mappers/temporary-unfitness.mapper';
import { TemporaryUnfitnessOrmEntity } from '../orm-entities/temporary-unfitness.orm-entity';

/** Quantos doadores cada consulta de `listActiveForDonors` cobre. */
export const DONOR_IDS_PER_QUERY = 1000;

@Injectable()
export class UnfitnessTypeOrmRepository implements UnfitnessRepository {
  constructor(
    @InjectRepository(TemporaryUnfitnessOrmEntity)
    private readonly repo: Repository<TemporaryUnfitnessOrmEntity>,
  ) {}

  async create(draft: NewTemporaryUnfitness): Promise<TemporaryUnfitness> {
    const saved = await this.repo.save(this.repo.create(draft));
    return TemporaryUnfitnessMapper.toDomain(saved);
  }

  async save(unfitness: TemporaryUnfitness): Promise<TemporaryUnfitness> {
    const saved = await this.repo.save(TemporaryUnfitnessMapper.toOrm(unfitness));
    return TemporaryUnfitnessMapper.toDomain(saved);
  }

  async findByIdAndDonor(id: string, donorId: string): Promise<TemporaryUnfitness | null> {
    const orm = await this.repo.findOne({ where: { id, donorId } });
    return orm ? TemporaryUnfitnessMapper.toDomain(orm) : null;
  }

  async listByDonor(donorId: string): Promise<TemporaryUnfitness[]> {
    const list = await this.repo.find({ where: { donorId }, order: { startDate: 'DESC' } });
    return list.map(TemporaryUnfitnessMapper.toDomain);
  }

  /** Com mais de uma em vigor, devolve a que mais restringe (ver TemporaryUnfitness.mostRestrictive). */
  async findActive(donorId: string, todayISO: string): Promise<TemporaryUnfitness | null> {
    const list = await this.activeAt(todayISO)
      .andWhere('i.donorId = :donorId', { donorId })
      .getMany();
    return TemporaryUnfitness.mostRestrictive(list.map(TemporaryUnfitnessMapper.toDomain));
  }

  /** Em lotes: o Postgres aceita no máximo 65.535 parâmetros por consulta. */
  async listActiveForDonors(donorIds: string[], todayISO: string): Promise<TemporaryUnfitness[]> {
    const found: TemporaryUnfitnessOrmEntity[] = [];
    for (let i = 0; i < donorIds.length; i += DONOR_IDS_PER_QUERY) {
      const batch = donorIds.slice(i, i + DONOR_IDS_PER_QUERY);
      found.push(
        ...(await this.activeAt(todayISO)
          .andWhere('i.donorId IN (:...batch)', { batch })
          .getMany()),
      );
    }
    return found.map(TemporaryUnfitnessMapper.toDomain);
  }

  /**
   * Inaptidões em vigor na data (mesma regra de `TemporaryUnfitness#isActiveAt`): encerrada, vale até
   * a véspera do encerramento; senão, até o fim previsto, ou sem fim.
   */
  private activeAt(todayISO: string) {
    return this.repo
      .createQueryBuilder('i')
      .where('i.startDate <= :today', { today: todayISO })
      .andWhere(
        '((i.actualEndDate IS NOT NULL AND :today < i.actualEndDate) OR (i.actualEndDate IS NULL AND (i.expectedEndDate IS NULL OR :today <= i.expectedEndDate)))',
        { today: todayISO },
      );
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  async replaceReasons(donorId: string, reason: string): Promise<void> {
    await this.repo.update({ donorId }, { reason });
  }
}
