import { BloodType } from '@shared/domain/enums';
import { IsEnum, IsOptional } from 'class-validator';

export class ListContactsQueryDto {
  @IsOptional()
  @IsEnum(BloodType)
  bloodType?: BloodType;
}
