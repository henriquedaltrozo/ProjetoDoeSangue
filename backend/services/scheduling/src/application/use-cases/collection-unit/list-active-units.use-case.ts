import { type CollectionUnitOutput, toCollectionUnitOutput } from '../../dto';
import { COLLECTION_UNIT_REPOSITORY, CollectionUnitRepository } from '../../ports';

/** Unidades ativas (usado pelo doador ao agendar). */
export class ListActiveUnitsUseCase {
  static readonly inject = [COLLECTION_UNIT_REPOSITORY] as const;

  constructor(private readonly units: CollectionUnitRepository) {}

  async execute(): Promise<CollectionUnitOutput[]> {
    return (await this.units.listActive()).map(toCollectionUnitOutput);
  }
}
