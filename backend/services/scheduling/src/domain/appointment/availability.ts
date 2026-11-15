import { businessDayInterval } from '@shared/domain/time';

export interface SlotAvailability {
  dateTime: string;
  occupiedSlots: number;
  availableSlots: number;
}

export interface AvailabilityQuery {
  collectionUnitId: string;
  date: string;
  simultaneousCapacity: number;
  times: SlotAvailability[];
}

/** Quantas vagas estão ocupadas num horário (agregado vindo da persistência). */
export interface OccupancyByTime {
  dateTime: Date;
  occupied: number;
}

/** Primeiro e último instante do dia AAAA-MM-DD no horário de Brasília (o dia que o doador escolhe na tela). */
export function dayInterval(dateISO: string): { start: Date; end: Date } {
  return businessDayInterval(dateISO);
}

export function buildAvailabilityQuery(
  collectionUnitId: string,
  dataISO: string,
  simultaneousCapacity: number,
  occupancies: OccupancyByTime[],
): AvailabilityQuery {
  return {
    collectionUnitId,
    date: dataISO,
    simultaneousCapacity,
    times: occupancies.map((o) => ({
      dateTime: new Date(o.dateTime).toISOString(),
      occupiedSlots: o.occupied,
      availableSlots: Math.max(simultaneousCapacity - o.occupied, 0),
    })),
  };
}
