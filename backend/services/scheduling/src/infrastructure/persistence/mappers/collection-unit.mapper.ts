import { NewCollectionUnit, CollectionUnit } from '../../../domain/collection-unit';
import { CollectionUnitOrmEntity } from '../orm-entities/collection-unit.orm-entity';

export const CollectionUnitMapper = {
  toDomain(orm: CollectionUnitOrmEntity): CollectionUnit {
    return new CollectionUnit({
      id: orm.id,
      name: orm.name,
      address: orm.address,
      neighborhood: orm.neighborhood ?? null,
      city: orm.city,
      uf: orm.uf,
      phone: orm.phone,
      simultaneousCapacity: orm.simultaneousCapacity,
      operatingHours: orm.operatingHours,
      active: orm.active,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  },

  toOrm(unit: CollectionUnit): CollectionUnitOrmEntity {
    return Object.assign(new CollectionUnitOrmEntity(), {
      id: unit.id,
      name: unit.name,
      address: unit.address,
      neighborhood: unit.neighborhood,
      city: unit.city,
      uf: unit.uf,
      phone: unit.phone,
      simultaneousCapacity: unit.simultaneousCapacity,
      operatingHours: unit.operatingHours,
      active: unit.active,
      createdAt: unit.createdAt,
      updatedAt: unit.updatedAt,
    });
  },

  newForOrm(draft: NewCollectionUnit): CollectionUnitOrmEntity {
    return Object.assign(new CollectionUnitOrmEntity(), draft);
  },
};
