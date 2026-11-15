import { AssessEligibilityDto } from '../dto/assess-eligibility.dto';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@shared/presentation/auth';
import { Role } from '@shared/domain/enums';
import { Actor } from '@shared/application/auth';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AssessEligibilityUseCase } from '../../../application/use-cases/assess-eligibility.use-case';
import { EligibilityHistoryUseCase } from '../../../application/use-cases/eligibility-history.use-case';
import {
  type AssessmentResponse,
  type CheckResponse,
  toAssessmentResponse,
  toCheckResponse,
} from '../presenters/assessment.presenter';

@ApiTags('eligibility')
@Controller('eligibility')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EligibilityController {
  constructor(
    private readonly assessEligibility: AssessEligibilityUseCase,
    private readonly eligibilityHistory: EligibilityHistoryUseCase,
  ) {}

  @Post('assess')
  @ApiOperation({
    summary:
      'Consulta a elegibilidade de um doador agora ("Posso doar hoje?"). Só responde: a consulta ' +
      'não é gravada no histórico',
  })
  async assess(
    @Body() dto: AssessEligibilityDto,
    @CurrentUser() user: Actor,
  ): Promise<CheckResponse> {
    return toCheckResponse(await this.assessEligibility.executeAs(dto, user));
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get(':donorId/history')
  @ApiOperation({
    summary:
      '[admin] Avaliações registradas do doador (agendamentos e pós-doação), para conferir por que ' +
      'um agendamento foi aceito',
  })
  async history(
    @Param('donorId', ParseUUIDPipe) donorId: string,
    @CurrentUser() user: Actor,
  ): Promise<AssessmentResponse[]> {
    const assessments = await this.eligibilityHistory.execute(donorId, user);
    return assessments.map(toAssessmentResponse);
  }
}
