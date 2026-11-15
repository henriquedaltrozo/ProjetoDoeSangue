import { type CollectionUnitOutput, toCollectionUnitOutput } from '../../dto';
import { COLLECTION_UNIT_REPOSITORY, CollectionUnitRepository } from '../../ports';
import { loadCollectionUnitOrFail } from '../shared/load-or-fail';

export class FindCollectionUnitUseCase {
  static readonly inject = [COLLECTION_UNIT_REPOSITORY] as const;

  constructor(private readonly units: CollectionUnitRepository) {}

  async execute(id: string): Promise<CollectionUnitOutput> {
    const unit = await loadCollectionUnitOrFail(this.units, id);
    return toCollectionUnitOutput(unit);
  }
}
