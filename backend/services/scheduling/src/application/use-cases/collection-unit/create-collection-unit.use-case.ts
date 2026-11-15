import { type CollectionUnitOutput, toCollectionUnitOutput } from '../../dto';
import { OperatingHours, CollectionUnit } from '../../../domain/collection-unit';
import { COLLECTION_UNIT_REPOSITORY, CollectionUnitRepository } from '../../ports';

export interface CreateCollectionUnitCommand {
  name: string;
  address: string;
  neighborhood: string;
  city: string;
  uf: string;
  phone: string;
  simultaneousCapacity: number;
  operatingHours?: OperatingHours;
}

/** [admin] Cadastra uma nova unidade de coleta. */
export class CreateCollectionUnitUseCase {
  static readonly inject = [COLLECTION_UNIT_REPOSITORY] as const;

  constructor(private readonly units: CollectionUnitRepository) {}

  async execute(command: CreateCollectionUnitCommand): Promise<CollectionUnitOutput> {
    return toCollectionUnitOutput(await this.units.create(CollectionUnit.draft(command)));
  }
}
