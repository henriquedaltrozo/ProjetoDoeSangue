import type { CollectionUnitOutput } from '../../../application/dto';

/** Representação HTTP de uma unidade de coleta. */
export interface CollectionUnitResponse {
  id: string;
  name: string;
  address: string;
  neighborhood: string | null;
  city: string;
  uf: string;
  phone: string;
  simultaneousCapacity: number;
  operatingHours: Record<string, string[]> | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toCollectionUnitResponse(unit: CollectionUnitOutput): CollectionUnitResponse {
  return {
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
  };
}
