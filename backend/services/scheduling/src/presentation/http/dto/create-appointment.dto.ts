import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreateAppointmentDto {
  @ApiProperty()
  @IsUUID()
  donorId: string;

  @ApiProperty()
  @IsUUID()
  collectionUnitId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @ApiProperty({ example: '2026-09-15T14:00:00.000Z' })
  @IsDateString()
  dateTime: string;
}
