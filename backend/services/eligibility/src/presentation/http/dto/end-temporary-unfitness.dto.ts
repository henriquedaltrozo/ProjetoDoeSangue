import { IsOptional } from 'class-validator';
import { EndTemporaryUnfitnessInput } from '../../../application/dto';
import { IsCalendarDate } from '@shared/presentation/http';

/** Encerra antecipadamente um período de inaptidão temporária ainda em aberto (actualEndDate nula). */
export class EndTemporaryUnfitnessDto implements EndTemporaryUnfitnessInput {
  @IsOptional()
  @IsCalendarDate()
  actualEndDate?: string;
}
