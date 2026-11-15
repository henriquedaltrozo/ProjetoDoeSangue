import {
  AvailabilityQuery,
  dayInterval,
  buildAvailabilityQuery,
} from '../../../domain/appointment';
import {
  APPOINTMENT_REPOSITORY,
  AVAILABILITY_CACHE,
  AppointmentRepository,
  AvailabilityCache,
  COLLECTION_UNIT_REPOSITORY,
  CollectionUnitRepository,
} from '../../ports';
import { loadCollectionUnitOrFail } from '../shared/load-or-fail';

const TTL_CACHE_SECONDS = 20;

/** Vagas ocupadas/disponíveis por horário, numa unidade e dia (cache-aside). */
export class CheckAvailabilityUseCase {
  static readonly inject = [
    COLLECTION_UNIT_REPOSITORY,
    APPOINTMENT_REPOSITORY,
    AVAILABILITY_CACHE,
  ] as const;

  constructor(
    private readonly units: CollectionUnitRepository,
    private readonly appointments: AppointmentRepository,
    private readonly cache: AvailabilityCache,
  ) {}

  async execute(collectionUnitId: string, dataISO: string): Promise<AvailabilityQuery> {
    const unit = await loadCollectionUnitOrFail(this.units, collectionUnitId);
    const inCache = await this.cache.get(collectionUnitId, dataISO);
    if (inCache) {
      return inCache;
    }

    const { start, end } = dayInterval(dataISO);
    const occupancies = await this.appointments.countOccupancyByTime(collectionUnitId, start, end);
    const result = buildAvailabilityQuery(
      collectionUnitId,
      dataISO,
      unit.simultaneousCapacity,
      occupancies,
    );

    await this.cache.store(collectionUnitId, dataISO, result, TTL_CACHE_SECONDS);
    return result;
  }
}
