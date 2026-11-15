import { AppointmentStatus } from '../../../domain/enums';
import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
  CONFIRMATION_TOKEN_SERVICE,
  ConfirmationTokenService,
} from '../../ports';
import { AttendanceConfirmationService } from '../../services/attendance-confirmation.service';
import { loadAppointmentOrFail } from '../shared/load-or-fail';

/** Resposta mínima da confirmação por link: não expõe dados do doador a quem só tem o token. */
export interface AttendanceConfirmationResult {
  id: string;
  dateTime: Date;
  status: AppointmentStatus;
  confirmedAt: Date | null;
}

/** Confirmação pelo link do e-mail: o token assinado dispensa o login. */
export class ConfirmAttendanceByTokenUseCase {
  static readonly inject = [
    APPOINTMENT_REPOSITORY,
    CONFIRMATION_TOKEN_SERVICE,
    AttendanceConfirmationService,
  ] as const;

  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly tokens: ConfirmationTokenService,
    private readonly confirmation: AttendanceConfirmationService,
  ) {}

  async execute(token: string): Promise<AttendanceConfirmationResult> {
    const appointmentId = this.tokens.verify(token);
    const existing = await loadAppointmentOrFail(this.appointments, appointmentId);
    const appointment = await this.confirmation.apply(existing);
    return {
      id: appointment.id,
      dateTime: appointment.dateTime,
      status: appointment.status,
      confirmedAt: appointment.confirmedAt,
    };
  }
}
