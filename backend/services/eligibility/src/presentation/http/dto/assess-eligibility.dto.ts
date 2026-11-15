import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { IsCalendarDate } from '@shared/presentation/http';
import { AssessEligibilityInput } from '@shared/application/dto';
import { AssessmentSource } from '@shared/domain/enums';

/**
 * Payload para POST /elegibilidade/avaliar no eligibility-service. Usado
 * tanto pela consulta espontânea do doador quanto (mais adiante) pela
 * validação síncrona disparada pelo scheduling-service ao confirmar um
 * agendamento.
 */
export class AssessEligibilityDto implements AssessEligibilityInput {
  @IsUUID()
  donorId: string;

  @IsEnum(AssessmentSource)
  origin: AssessmentSource;

  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @ApiPropertyOptional({
    description: 'Dia da doação pretendida (AAAA-MM-DD): as regras de idade são conferidas nele',
  })
  @IsOptional()
  @IsCalendarDate()
  donationDate?: string;
}
