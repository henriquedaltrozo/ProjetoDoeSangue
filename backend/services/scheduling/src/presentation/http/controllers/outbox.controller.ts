import { Role } from '@shared/domain/enums';
import { JwtAuthGuard, Roles, RolesGuard } from '@shared/presentation/auth';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListOutboxFailuresUseCase } from '../../../application/use-cases/outbox/list-outbox-failures.use-case';
import {
  ReconcileOutboxUseCase,
  ReconciliationResult,
} from '../../../application/use-cases/outbox/reconcile-outbox.use-case';
import { ReprocessEventOutboxUseCase } from '../../../application/use-cases/outbox/reprocess-event-outbox.use-case';
import {
  type OutboxEventResponse,
  toOutboxEventResponse,
} from '../presenters/outbox-event.presenter';

@ApiTags('outbox')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('outbox')
export class OutboxController {
  constructor(
    private readonly reconcileOutbox: ReconcileOutboxUseCase,
    private readonly listOutboxFailures: ListOutboxFailuresUseCase,
    private readonly reprocessEvent: ReprocessEventOutboxUseCase,
  ) {}

  @Post('reconcile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      '[admin] Executa agora a reconciliação (cria eventos faltantes e reativa falhas); ' +
      'ela também roda sozinha a cada 10 minutos',
  })
  reconcile(): Promise<ReconciliationResult> {
    return this.reconcileOutbox.execute();
  }

  @Get('failures')
  @ApiOperation({ summary: '[admin] Lista os eventos do outbox que esgotaram as tentativas' })
  async failures(): Promise<OutboxEventResponse[]> {
    return (await this.listOutboxFailures.execute()).map(toOutboxEventResponse);
  }

  @Post(':id/reprocess')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[admin] Devolve um evento em FAILURE para a fila (zera as tentativas)',
  })
  async reprocess(@Param('id', ParseUUIDPipe) id: string): Promise<OutboxEventResponse> {
    return toOutboxEventResponse(await this.reprocessEvent.execute(id));
  }
}
