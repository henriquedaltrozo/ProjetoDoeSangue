import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class RegisterPermanentUnfitnessDto {
  @ApiProperty({ example: 'Hepatite B confirmada em exame' })
  @IsString()
  @Length(3, 255)
  reason: string;
}
