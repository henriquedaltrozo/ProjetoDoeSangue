import { AssessmentSource, EligibilityResult } from '@shared/domain/enums';
import { toBusinessDate } from '@shared/domain/time';
import { type AppointmentOutput, toAppointmentOutput } from '../../dto';
import { BusinessRuleError } from '../../../domain/errors';
import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
  CLOCK,
  Clock,
  ELIGIBILITY_GATEWAY,
  EligibilityGateway,
} from '../../ports';
import { loadAppointmentOrFail } from '../shared/load-or-fail';

/**
 * [admin] Registra o check-in do doador na unidade, depois de reavaliar a elegibilidade para hoje:
 * desde o agendamento podem ter surgido uma inaptidão, outra doação ou o fim de uma avaliação médica.
 * Se o doador não está apto, o check-in é recusado (a avaliação fica no histórico dele, com os
 * motivos) e a equipe cancela o agendamento.
 */
export class PerformCheckinUseCase {
  static readonly inject = [APPOINTMENT_REPOSITORY, ELIGIBILITY_GATEWAY, CLOCK] as const;

  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly eligibility: EligibilityGateway,
    private readonly clock: Clock,
  ) {}

  async execute(id: string): Promise<AppointmentOutput> {
    const appointment = await loadAppointmentOrFail(this.appointments, id);
    const now = this.clock.now();
    // Primeiro a transição (estado e dia do agendamento), só em memória: um check-in fora do dia
    // é recusado antes de gravar uma reavaliação inútil no histórico do doador.
    appointment.makeCheckin(now);
    const assessment = await this.eligibility.assessInternal({
      donorId: appointment.donorId,
      origin: AssessmentSource.APPOINTMENT_VALIDATION,
      appointmentId: appointment.id,
      donationDate: toBusinessDate(now),
    });
    if (assessment.result !== EligibilityResult.ELIGIBLE) {
      throw new BusinessRuleError(
        'Na reavaliação do check-in, o doador não está apto a doar hoje. Veja os motivos no histórico de elegibilidade dele e cancele o agendamento.',
      );
    }
    return toAppointmentOutput(await this.appointments.save(appointment));
  }
}
