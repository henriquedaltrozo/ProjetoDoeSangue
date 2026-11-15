import { NewCollectionUnit, CollectionUnit } from '../../domain/collection-unit';

export const COLLECTION_UNIT_REPOSITORY = Symbol('COLLECTION_UNIT_REPOSITORY');

export interface CollectionUnitRepository {
  create(draft: NewCollectionUnit): Promise<CollectionUnit>;
  save(unit: CollectionUnit): Promise<CollectionUnit>;
  findById(id: string): Promise<CollectionUnit | null>;
  /** Ordenadas por nome. */
  listActive(): Promise<CollectionUnit[]>;
  /** Ativas e inativas, ordenadas por nome. */
  listAll(): Promise<CollectionUnit[]>;
}
