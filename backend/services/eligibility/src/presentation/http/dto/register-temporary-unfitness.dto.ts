import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { RegisterTemporaryUnfitnessInput } from '../../../application/dto';
import { UnfitnessCategory } from '../../../domain/enums';
import { IsCalendarDate } from '@shared/presentation/http';

export class RegisterTemporaryUnfitnessDto implements RegisterTemporaryUnfitnessInput {
  @IsString()
  @Length(3, 255)
  reason: string;

  @IsEnum(UnfitnessCategory)
  category: UnfitnessCategory;

  @IsCalendarDate()
  startDate: string;

  @IsOptional()
  @IsCalendarDate()
  expectedEndDate?: string;
}
