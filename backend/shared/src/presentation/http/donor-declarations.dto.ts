import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Equals, IsBoolean, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { BloodType } from '../../domain/enums';
import { IsCalendarDate } from './is-calendar-date.decorator';

/**
 * Declarações do doador que podem ser corrigidas depois do cadastro. O que é obrigatório depende da
 * idade e é validado pelo domínio do eligibility-service (aqui só os tipos e formatos).
 */
export class DonorDeclarationsDto {
  @ApiPropertyOptional({ description: 'Menores de 18 anos: nome do responsável legal' })
  @IsOptional()
  @IsString()
  @Length(3, 150)
  guardianName?: string;

  @ApiPropertyOptional({
    description:
      'Menores de 18 anos: apresentará o termo de consentimento assinado pelo responsável',
  })
  @IsOptional()
  @IsBoolean()
  guardianConsent?: boolean;

  @ApiPropertyOptional({ description: '60 anos ou mais: já doou sangue antes dos 60 anos' })
  @IsOptional()
  @IsBoolean()
  donatedBefore60?: boolean;

  @ApiPropertyOptional({ description: '70 anos ou mais: é doador voluntário regular' })
  @IsOptional()
  @IsBoolean()
  regularDonor?: boolean;
}

/**
 * No cadastro, o doador também informa a data da última doação (se já doou), o tipo sanguíneo (se
 * souber) e dá o consentimento para o uso dos dados de saúde.
 */
export class DonorRegistrationDeclarationsDto extends DonorDeclarationsDto {
  @ApiProperty({
    description:
      '[LGPD] Concorda com o uso dos dados de saúde (peso, tipo sanguíneo, doações) para avaliar a elegibilidade. Precisa ser true.',
  })
  @IsBoolean()
  @Equals(true, {
    message: 'É preciso concordar com o uso dos seus dados de saúde para se cadastrar.',
  })
  healthDataConsent: boolean;

  @ApiPropertyOptional({ enum: BloodType, description: 'Tipo sanguíneo, se o doador souber' })
  @IsOptional()
  @IsEnum(BloodType)
  bloodType?: BloodType;

  @ApiPropertyOptional({ example: '2026-05-10', description: 'Data da última doação, se houver' })
  @IsOptional()
  @IsCalendarDate()
  lastDonationDate?: string;
}
