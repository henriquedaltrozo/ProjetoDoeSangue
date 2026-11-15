import { AssessEligibilityDto } from '../dto/assess-eligibility.dto';
import { InternalApiKeyGuard } from '@shared/presentation/auth';
import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AssessEligibilityUseCase } from '../../../application/use-cases/assess-eligibility.use-case';
import { type AssessmentResponse, toAssessmentResponse } from '../presenters/assessment.presenter';

/**
 * Avaliação chamada por outro serviço por conta própria (sem usuário na
 * requisição), autenticada pela x-internal-api-key. É o que permite ao
 * scheduling-service reprocessar o pós-doação em segundo plano (outbox), sem
 * depender do token de um admin que já pode ter expirado.
 */
@ApiTags('eligibility')
@Controller('eligibility/internal')
@UseGuards(InternalApiKeyGuard)
export class InternalEligibilityController {
  constructor(private readonly assessEligibility: AssessEligibilityUseCase) {}

  @Post('assess')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[interno] Avalia a elegibilidade de um doador (chave interna)' })
  async assess(@Body() dto: AssessEligibilityDto): Promise<AssessmentResponse> {
    return toAssessmentResponse(await this.assessEligibility.execute(dto));
  }
}
