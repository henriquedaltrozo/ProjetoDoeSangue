import type { UnfitnessCategory } from '../../../domain/enums';
import type { TemporaryUnfitnessOutput } from '../../../application/dto';

/** Representação HTTP de um período de inaptidão temporária. */
export interface UnfitnessResponse {
  id: string;
  donorId: string;
  reason: string;
  category: UnfitnessCategory;
  startDate: string;
  expectedEndDate: string | null;
  actualEndDate: string | null;
  registeredBy: string | null;
  createdAt: string;
}

export function toUnfitnessResponse(u: TemporaryUnfitnessOutput): UnfitnessResponse {
  return {
    id: u.id,
    donorId: u.donorId,
    reason: u.reason,
    category: u.category,
    startDate: u.startDate,
    expectedEndDate: u.expectedEndDate,
    actualEndDate: u.actualEndDate,
    registeredBy: u.registeredBy,
    createdAt: u.createdAt.toISOString(),
  };
}
