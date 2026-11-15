import { Role } from '@shared/domain/enums';
import { JwtAuthGuard, Roles, RolesGuard } from '@shared/presentation/auth';
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  ListFailedJobsUseCase,
  ListSentNotificationsUseCase,
  ListSuppressedUseCase,
  RemoveSuppressedUseCase,
  RetryFailedJobUseCase,
} from '../../application/use-cases/notifications-admin.use-cases';
import { NotificationStatus } from '../../domain/enums';

export class ListSentQueryDto {
  @ApiPropertyOptional({ enum: NotificationStatus })
  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  page: number = 1;
}

/** [admin] Acompanhamento dos e-mails: registro de envios, falhas definitivas e endereços bloqueados. */
@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('notifications')
export class NotificationsAdminController {
  constructor(
    private readonly listSent: ListSentNotificationsUseCase,
    private readonly listFailed: ListFailedJobsUseCase,
    private readonly retryFailed: RetryFailedJobUseCase,
    private readonly listSuppressed: ListSuppressedUseCase,
    private readonly removeSuppressed: RemoveSuppressedUseCase,
  ) {}

  @Get('sent')
  @ApiOperation({
    summary: '[admin] Registro de envios (mais recentes primeiro), e-mails mascarados',
  })
  sent(@Query() query: ListSentQueryDto) {
    return this.listSent.execute(query.page, query.status);
  }

  @Get('failed-jobs')
  @ApiOperation({ summary: '[admin] E-mails que esgotaram as tentativas (guardados por 7 dias)' })
  failedJobs() {
    return this.listFailed.execute();
  }

  @Post('failed-jobs/:id/retry')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[admin] Devolve à fila um e-mail que falhou de vez' })
  async retry(@Param('id') id: string): Promise<void> {
    await this.retryFailed.execute(id);
  }

  @Get('suppressed')
  @ApiOperation({ summary: '[admin] Endereços bloqueados (devolveram e-mail ou marcaram spam)' })
  suppressed() {
    return this.listSuppressed.execute();
  }

  @Delete('suppressed/:email')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[admin] Desbloqueia um endereço' })
  async unblock(@Param('email') email: string): Promise<void> {
    await this.removeSuppressed.execute(email);
  }
}
