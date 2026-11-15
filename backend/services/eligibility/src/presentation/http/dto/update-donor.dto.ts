import { BloodType, Sex } from '@shared/domain/enums';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { DonorDeclarationsDto, IsCalendarDate } from '@shared/presentation/http';

/**
 * Campos que o próprio doador (ou um admin) pode corrigir depois do cadastro: dados pessoais, contato,
 * dados de saúde, última doação e as declarações. Nome e e-mail são trocados na conta (PATCH
 * /auth/me); status e consentimento são do sistema e não são editáveis.
 */
export class UpdateDonorDto extends DonorDeclarationsDto {
  @ApiPropertyOptional({ description: '11 dígitos, sem máscara' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{11}$/, { message: 'O CPF deve ter exatamente 11 dígitos numéricos, sem máscara.' })
  cpf?: string;

  @ApiPropertyOptional({ example: '1995-04-12' })
  @IsOptional()
  @IsCalendarDate()
  birthDate?: string;

  @ApiPropertyOptional({ enum: Sex })
  @IsOptional()
  @IsEnum(Sex)
  sex?: Sex;

  @ApiPropertyOptional({
    nullable: true,
    description: 'DDD + número, só dígitos (10 ou 11); null apaga',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{10,11}$/, { message: 'Informe o telefone com DDD, só números (10 ou 11 dígitos).' })
  phone?: string | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 300 })
  @IsOptional()
  @IsNumber()
  // Mesma faixa do domínio (MIN/MAX_PLAUSIBLE_WEIGHT_KG), que também a confere.
  @Min(1, { message: 'Informe um peso válido.' })
  @Max(300, { message: 'Informe um peso válido.' })
  weightKg?: number;

  @ApiPropertyOptional({ enum: BloodType })
  @IsOptional()
  @IsEnum(BloodType)
  bloodType?: BloodType;

  @ApiPropertyOptional({
    example: '2026-05-10',
    description: 'Última doação (inclusive fora do sistema); não pode ser anterior à já registrada',
  })
  @IsOptional()
  @IsCalendarDate()
  lastDonationDate?: string;

  @ApiPropertyOptional({
    description: 'Aceita receber por e-mail avisos de campanhas e de quando pode doar de novo',
  })
  @IsOptional()
  @IsBoolean()
  receiveAlerts?: boolean;
}
