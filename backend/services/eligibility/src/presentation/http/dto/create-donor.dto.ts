import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { CreateDonorInput } from '@shared/application/dto';
import { Sex } from '@shared/domain/enums';
import { IsCalendarDate } from '@shared/presentation/http';
import { DonorRegistrationDeclarationsDto } from '@shared/presentation/http';

/**
 * Payload enviado pelo auth-service ao eligibility-service (POST
 * /donors) no momento do cadastro de um novo doador. Endpoint interno -
 * não é chamado pelo frontend diretamente.
 */
export class CreateDonorDto extends DonorRegistrationDeclarationsDto implements CreateDonorInput {
  @IsUUID()
  userId: string;

  @IsString()
  @Length(3, 150)
  completeName: string;

  @IsString()
  @Matches(/^\d{11}$/, { message: 'O CPF deve ter exatamente 11 dígitos numéricos, sem máscara.' })
  cpf: string;

  @IsCalendarDate()
  birthDate: string;

  @IsEnum(Sex)
  sex: Sex;

  @IsEmail()
  email: string;

  @IsOptional()
  @Matches(/^\d{10,11}$/, { message: 'Informe o telefone com DDD, só números (10 ou 11 dígitos).' })
  phone?: string;

  @IsNumber()
  // Mesma faixa do domínio (MIN/MAX_PLAUSIBLE_WEIGHT_KG), que também a confere.
  @Min(1, { message: 'Informe um peso válido.' })
  @Max(300, { message: 'Informe um peso válido.' })
  weightKg: number;

  /** Num cadastro novo, false: o doador confirma o e-mail pelo link (ausente = já confirmado). */
  @IsOptional()
  @IsBoolean()
  emailVerified?: boolean;
}
