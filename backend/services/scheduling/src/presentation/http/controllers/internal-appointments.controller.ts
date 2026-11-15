import { InternalApiKeyGuard } from '@shared/presentation/auth';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';
import { CancelDonorAppointmentsUseCase } from '../../../application/use-cases/appointment/cancel-donor-appointments.use-case';
import { FindDonorsWithOpenAppointmentUseCase } from '../../../application/use-cases/appointment/find-donors-with-open-appointment.use-case';

/**
 * Rotas de agendamento chamadas só por outros serviços, autenticadas pela x-internal-api-key. O
 * gateway não as repassa (404 na porta pública). Registrado antes do AppointmentsController.
 */
export class DonorIdsDto {
  @IsArray()
  @ArrayMaxSize(5000)
  @IsUUID('all', { each: true })
  donorIds: string[];
}

@ApiTags('appointments')
@Controller('appointments/internal')
@UseGuards(InternalApiKeyGuard)
export class InternalAppointmentsController {
  constructor(
    private readonly cancelDonorAppointments: CancelDonorAppointmentsUseCase,
    private readonly findDonorsWithOpen: FindDonorsWithOpenAppointmentUseCase,
  ) {}

  @Post('donors-with-open-appointment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      '[interno] Dos doadores informados, os que têm agendamento em aberto (usado pelo eligibility ' +
      'para não avisar "já pode doar" a quem já agendou)',
  })
  async donorsWithOpen(@Body() dto: DonorIdsDto): Promise<{ donorIds: string[] }> {
    return { donorIds: await this.findDonorsWithOpen.execute(dto.donorIds) };
  }

  @Post('donors/:donorId/cancel-open')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      '[LGPD, interno] Cancela os agendamentos em aberto do doador e remove os lembretes da fila ' +
      '(chamado pelo auth-service na exclusão da conta)',
  })
  cancelOpen(@Param('donorId', ParseUUIDPipe) donorId: string): Promise<{ canceled: number }> {
    return this.cancelDonorAppointments.execute(donorId);
  }
}
