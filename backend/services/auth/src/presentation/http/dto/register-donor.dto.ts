import { MaxPasswordBytes } from './password.validator';
import { Sex } from '@shared/domain/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { IsCalendarDate } from '@shared/presentation/http';
import { DonorRegistrationDeclarationsDto } from '@shared/presentation/http';

export class RegisterDonorDto extends DonorRegistrationDeclarationsDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxPasswordBytes()
  password: string;

  @ApiProperty()
  @IsString()
  @Length(3, 150)
  name: string;

  @ApiProperty({ description: 'Somente dígitos, 11 caracteres' })
  @IsString()
  @Matches(/^\d{11}$/, { message: 'O CPF deve ter exatamente 11 dígitos numéricos, sem máscara.' })
  cpf: string;

  @ApiProperty({ example: '1995-04-12' })
  @IsCalendarDate()
  birthDate: string;

  @ApiProperty({ enum: Sex })
  @IsEnum(Sex)
  sex: Sex;

  @ApiPropertyOptional({ description: 'Opcional: DDD + número, só dígitos (10 ou 11)' })
  @IsOptional()
  @Matches(/^\d{10,11}$/, { message: 'Informe o telefone com DDD, só números (10 ou 11 dígitos).' })
  phone?: string;

  @ApiProperty({ minimum: 1, maximum: 300 })
  @IsNumber()
  @Min(1, { message: 'Informe um peso válido.' })
  @Max(300, { message: 'Informe um peso válido.' })
  weightKg: number;
}
