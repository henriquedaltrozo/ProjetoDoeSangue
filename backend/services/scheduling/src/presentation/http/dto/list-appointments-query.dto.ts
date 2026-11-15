import { AppointmentStatus } from '../../../domain/enums';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { IsCalendarDate } from '@shared/presentation/http';

/** Filtros opcionais para o admin navegar a lista de agendamentos (ver AppointmentsController.list). */
export class ListAppointmentsQueryDto {
  @ApiPropertyOptional({ enum: AppointmentStatus })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  collectionUnitId?: string;

  @ApiPropertyOptional({
    example: '2026-09-15',
    description: 'Filtra agendamentos deste dia (horário de Brasília).',
  })
  @IsOptional()
  @IsCalendarDate()
  date?: string;
}
