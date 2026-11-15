import { type CollectionUnitOutput, toCollectionUnitOutput } from '../../dto';
import { COLLECTION_UNIT_REPOSITORY, CollectionUnitRepository } from '../../ports';
import { loadCollectionUnitOrFail } from '../shared/load-or-fail';

/** [admin] Reativa uma unidade de coleta previamente desativada. */
export class ReactivateCollectionUnitUseCase {
  static readonly inject = [COLLECTION_UNIT_REPOSITORY] as const;

  constructor(private readonly units: CollectionUnitRepository) {}

  async execute(id: string): Promise<CollectionUnitOutput> {
    const unit = await loadCollectionUnitOrFail(this.units, id);
    unit.reactivate();
    return toCollectionUnitOutput(await this.units.save(unit));
  }
}
