import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { IsCalendarDate } from '@shared/presentation/http';

export class CheckAvailabilityQueryDto {
  @ApiProperty()
  @IsUUID()
  collectionUnitId: string;

  @ApiProperty({ example: '2026-09-15' })
  @IsCalendarDate()
  date: string;
}
