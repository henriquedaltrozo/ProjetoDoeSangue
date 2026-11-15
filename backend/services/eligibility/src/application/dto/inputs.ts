import type { UnfitnessCategory } from '../../domain/enums';

/** Entradas dos casos de uso que só o eligibility-service recebe (as trocadas entre serviços ficam em @shared/application/dto). */
export interface RegisterTemporaryUnfitnessInput {
  reason: string;
  category: UnfitnessCategory;
  startDate: string;
  expectedEndDate?: string;
}

/** Encerra antecipadamente um período de inaptidão temporária ainda em aberto (actualEndDate nula). */
export interface EndTemporaryUnfitnessInput {
  actualEndDate?: string;
}
