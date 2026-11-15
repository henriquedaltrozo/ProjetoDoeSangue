import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ConfirmAttendanceTokenDto {
  @ApiProperty({ description: 'Token recebido no link de confirmação enviado por e-mail.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token: string;
}
