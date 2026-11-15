import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CollectionUnitRepository } from '../../../application/ports';
import { NewCollectionUnit, CollectionUnit } from '../../../domain/collection-unit';
import { CollectionUnitMapper } from '../mappers/collection-unit.mapper';
import { CollectionUnitOrmEntity } from '../orm-entities/collection-unit.orm-entity';

@Injectable()
export class CollectionUnitTypeOrmRepository implements CollectionUnitRepository {
  constructor(
    @InjectRepository(CollectionUnitOrmEntity)
    private readonly repo: Repository<CollectionUnitOrmEntity>,
  ) {}

  async create(draft: NewCollectionUnit): Promise<CollectionUnit> {
    const saved = await this.repo.save(CollectionUnitMapper.newForOrm(draft));
    return CollectionUnitMapper.toDomain(saved);
  }

  async save(unit: CollectionUnit): Promise<CollectionUnit> {
    const saved = await this.repo.save(CollectionUnitMapper.toOrm(unit));
    return CollectionUnitMapper.toDomain(saved);
  }

  async findById(id: string): Promise<CollectionUnit | null> {
    const orm = await this.repo.findOne({ where: { id } });
    return orm ? CollectionUnitMapper.toDomain(orm) : null;
  }

  async listActive(): Promise<CollectionUnit[]> {
    const list = await this.repo.find({ where: { active: true }, order: { name: 'ASC' } });
    return list.map(CollectionUnitMapper.toDomain);
  }

  async listAll(): Promise<CollectionUnit[]> {
    const list = await this.repo.find({ order: { name: 'ASC' } });
    return list.map(CollectionUnitMapper.toDomain);
  }
}
