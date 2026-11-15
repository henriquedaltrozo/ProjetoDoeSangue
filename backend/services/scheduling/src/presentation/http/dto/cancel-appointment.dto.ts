import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class CancelAppointmentDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(3, 500)
  cancellationReason?: string;
}
