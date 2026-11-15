import { TemporaryUnfitness } from '../../../domain/entities/temporary-unfitness';
import { TemporaryUnfitnessOrmEntity } from '../orm-entities/temporary-unfitness.orm-entity';

export const TemporaryUnfitnessMapper = {
  toDomain(orm: TemporaryUnfitnessOrmEntity): TemporaryUnfitness {
    return new TemporaryUnfitness({
      id: orm.id,
      donorId: orm.donorId,
      reason: orm.reason,
      category: orm.category,
      startDate: orm.startDate,
      expectedEndDate: orm.expectedEndDate ?? null,
      actualEndDate: orm.actualEndDate ?? null,
      registeredBy: orm.registeredBy ?? null,
      createdAt: orm.createdAt,
    });
  },

  toOrm(unfitness: TemporaryUnfitness): TemporaryUnfitnessOrmEntity {
    return Object.assign(new TemporaryUnfitnessOrmEntity(), {
      id: unfitness.id,
      donorId: unfitness.donorId,
      reason: unfitness.reason,
      category: unfitness.category,
      startDate: unfitness.startDate,
      expectedEndDate: unfitness.expectedEndDate,
      actualEndDate: unfitness.actualEndDate,
      registeredBy: unfitness.registeredBy,
      createdAt: unfitness.createdAt,
    });
  },
};
