import { Role } from '@shared/domain/enums';
import { Actor } from '@shared/application/auth';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@shared/presentation/auth';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FindAppointmentUseCase } from '../../../application/use-cases/appointment/find-appointment.use-case';
import { CancelAppointmentUseCase } from '../../../application/use-cases/appointment/cancel-appointment.use-case';
import { CompleteAppointmentUseCase } from '../../../application/use-cases/appointment/complete-appointment.use-case';
import { ConfirmAttendanceUseCase } from '../../../application/use-cases/appointment/confirm-attendance.use-case';
import { CheckAvailabilityUseCase } from '../../../application/use-cases/appointment/check-availability.use-case';
import { CreateAppointmentUseCase } from '../../../application/use-cases/appointment/create-appointment.use-case';
import { ListDonorAppointmentsUseCase } from '../../../application/use-cases/appointment/list-donor-appointments.use-case';
import { ListAppointmentsUseCase } from '../../../application/use-cases/appointment/list-appointments.use-case';
import { MarkNoShowUseCase } from '../../../application/use-cases/appointment/mark-no-show.use-case';
import { PerformCheckinUseCase } from '../../../application/use-cases/appointment/perform-checkin.use-case';
import { CancelAppointmentDto } from '../dto/cancel-appointment.dto';
import { CheckAvailabilityQueryDto } from '../dto/check-availability-query.dto';
import { CreateAppointmentDto } from '../dto/create-appointment.dto';
import { ListAppointmentsQueryDto } from '../dto/list-appointments-query.dto';
import {
  type AppointmentCreatedResponse,
  type AppointmentResponse,
  toAppointmentCreatedResponse,
  toAppointmentResponse,
} from '../presenters/appointment.presenter';

@ApiTags('appointments')
@Controller('appointments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AppointmentsController {
  constructor(
    private readonly createAppointment: CreateAppointmentUseCase,
    private readonly findAppointment: FindAppointmentUseCase,
    private readonly listByDonor: ListDonorAppointmentsUseCase,
    private readonly listAppointments: ListAppointmentsUseCase,
    private readonly checkAvailability: CheckAvailabilityUseCase,
    private readonly cancelAppointment: CancelAppointmentUseCase,
    private readonly confirmAttendanceUseCase: ConfirmAttendanceUseCase,
    private readonly performCheckin: PerformCheckinUseCase,
    private readonly markNoShow: MarkNoShowUseCase,
    private readonly completeAppointment: CompleteAppointmentUseCase,
  ) {}

  @Get('availability')
  @ApiOperation({ summary: 'Vagas ocupadas/disponíveis por horário, numa unidade e data' })
  availability(@Query() query: CheckAvailabilityQueryDto) {
    return this.checkAvailability.execute(query.collectionUnitId, query.date);
  }

  @Get('me')
  @ApiOperation({ summary: 'Histórico de agendamentos do doador autenticado' })
  async myAppointments(@CurrentUser() user: Actor): Promise<AppointmentResponse[]> {
    const appointments = await this.listByDonor.execute(user.donorId);
    return appointments.map(toAppointmentResponse);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  @ApiOperation({
    summary:
      '[admin] Lista agendamentos com filtros opcionais (status, unidade, data) - usado pelo ' +
      'painel admin para localizar agendamentos e fazer check-in/conclusão',
  })
  async list(@Query() query: ListAppointmentsQueryDto): Promise<AppointmentResponse[]> {
    const appointments = await this.listAppointments.execute(query);
    return appointments.map(toAppointmentResponse);
  }

  @Post()
  @ApiOperation({
    summary:
      'Cria um agendamento e valida a elegibilidade de forma síncrona junto ao ' +
      'eligibility-service (ver docs/02, diagrama de sequência)',
  })
  async create(
    @Body() dto: CreateAppointmentDto,
    @CurrentUser() user: Actor,
  ): Promise<AppointmentCreatedResponse> {
    return toAppointmentCreatedResponse(await this.createAppointment.execute(dto, user));
  }

  @Get(':id')
  async find(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: Actor,
  ): Promise<AppointmentResponse> {
    const appointment = await this.findAppointment.execute(id, user);
    return toAppointmentResponse(appointment);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancela um agendamento (dono ou admin)' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelAppointmentDto,
    @CurrentUser() user: Actor,
  ): Promise<AppointmentResponse> {
    return toAppointmentResponse(
      await this.cancelAppointment.execute(id, user, dto.cancellationReason),
    );
  }

  @Post(':id/confirm-attendance')
  @ApiOperation({
    summary:
      'Confirma a presença no agendamento (dono ou admin em nome do doador); ' +
      'ELIGIBILITY_CONFIRMED -> CONFIRMED, idempotente',
  })
  async confirmAttendance(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: Actor,
  ): Promise<AppointmentResponse> {
    return toAppointmentResponse(await this.confirmAttendanceUseCase.execute(id, user));
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post(':id/checkin')
  @ApiOperation({ summary: '[admin] Registra o check-in do doador na unidade' })
  async checkin(@Param('id', ParseUUIDPipe) id: string): Promise<AppointmentResponse> {
    return toAppointmentResponse(await this.performCheckin.execute(id));
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post(':id/no-show')
  @ApiOperation({
    summary:
      '[admin] Marca um agendamento (com elegibilidade ou presença confirmada e já no ' +
      'passado) como não comparecido',
  })
  async noShow(@Param('id', ParseUUIDPipe) id: string): Promise<AppointmentResponse> {
    return toAppointmentResponse(await this.markNoShow.execute(id));
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post(':id/complete')
  @ApiOperation({
    summary:
      '[admin] Conclui a doação: atualiza lastDonationAt no eligibility-service e enfileira ' +
      'a notificação de intervalo mínimo concluído',
  })
  async complete(@Param('id', ParseUUIDPipe) id: string): Promise<AppointmentResponse> {
    return toAppointmentResponse(await this.completeAppointment.execute(id));
  }
}
