import { type CollectionUnitOutput, toCollectionUnitOutput } from '../../dto';
import { COLLECTION_UNIT_REPOSITORY, CollectionUnitRepository } from '../../ports';

/** [admin] Quando includeInactive é true, retorna também unidades desativadas. */
export class ListUnitsUseCase {
  static readonly inject = [COLLECTION_UNIT_REPOSITORY] as const;

  constructor(private readonly units: CollectionUnitRepository) {}

  async execute(includeInactive: boolean): Promise<CollectionUnitOutput[]> {
    return (await (includeInactive ? this.units.listAll() : this.units.listActive())).map(
      toCollectionUnitOutput,
    );
  }
}
