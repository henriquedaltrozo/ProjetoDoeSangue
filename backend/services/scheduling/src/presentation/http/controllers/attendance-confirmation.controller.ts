import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfirmAttendanceByTokenUseCase } from '../../../application/use-cases/appointment/confirm-attendance-by-token.use-case';
import { ConfirmAttendanceTokenDto } from '../dto/confirm-attendance-token.dto';

/**
 * Confirmação de presença pelo link do e-mail. Fica num controller à parte
 * porque, ao contrário do AppointmentsController, NÃO exige JWT: quem prova o
 * direito de confirmar é o token assinado do link (ver ConfirmationTokenService).
 * O gateway já roteia todo o prefixo /appointments para este serviço.
 */
@ApiTags('appointments')
@Controller('appointments/confirm-attendance')
export class AttendanceConfirmationController {
  constructor(private readonly confirmByToken: ConfirmAttendanceByTokenUseCase) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      '[público, por token] Confirma a presença a partir do link enviado por e-mail. ' +
      '400 se o token for inválido, 410 se expirou, 409 se o agendamento não puder mais ser confirmado',
  })
  confirm(@Body() dto: ConfirmAttendanceTokenDto) {
    return this.confirmByToken.execute(dto.token);
  }
}
