import { AvailabilityQuery } from '../../domain/appointment';

export const AVAILABILITY_CACHE = Symbol('AVAILABILITY_CACHE');

/**
 * Cache dos horários disponíveis por unidade e dia. Melhor esforço: se o
 * armazenamento estiver fora do ar, as chamadas viram no-op e o banco continua
 * sendo a fonte de verdade.
 */
export interface AvailabilityCache {
  get(collectionUnitId: string, dataISO: string): Promise<AvailabilityQuery | null>;
  store(
    collectionUnitId: string,
    dataISO: string,
    query: AvailabilityQuery,
    ttlSeconds: number,
  ): Promise<void>;
  /** Invalida o dia (de calendário, em Brasília) a que `dateTime` pertence. */
  invalidateDay(collectionUnitId: string, dateTime: Date): Promise<void>;
}
