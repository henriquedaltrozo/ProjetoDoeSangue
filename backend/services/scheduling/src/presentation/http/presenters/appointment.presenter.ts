import type { EligibilityAssessmentOutput } from '@shared/application/dto';
import type { AssessmentNotice } from '@shared/domain/enums';
import type { AppointmentStatus } from '../../../domain/enums';
import type { AppointmentOutput } from '../../../application/dto';

/** Representação HTTP de um agendamento (contrato da API, independente da entidade de domínio). */
export interface AppointmentResponse {
  id: string;
  donorId: string;
  collectionUnitId: string;
  campaignId: string | null;
  dateTime: Date;
  status: AppointmentStatus;
  assessmentEligibilityId: string | null;
  eligibilityNotices: AssessmentNotice[];
  cancellationReason: string | null;
  confirmedAt: Date | null;
  checkinAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toAppointmentResponse(appointment: AppointmentOutput): AppointmentResponse {
  return {
    id: appointment.id,
    donorId: appointment.donorId,
    collectionUnitId: appointment.collectionUnitId,
    campaignId: appointment.campaignId,
    dateTime: appointment.dateTime,
    status: appointment.status,
    assessmentEligibilityId: appointment.assessmentEligibilityId,
    eligibilityNotices: appointment.eligibilityNotices,
    cancellationReason: appointment.cancellationReason,
    confirmedAt: appointment.confirmedAt,
    checkinAt: appointment.checkinAt,
    completedAt: appointment.completedAt,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt,
  };
}

/** Resposta da criação: o agendamento com o resultado da avaliação de elegibilidade anexado. */
export interface AppointmentCreatedResponse extends AppointmentResponse {
  eligibilityAssessment?: EligibilityAssessmentOutput;
}

export function toAppointmentCreatedResponse(
  created: AppointmentOutput & { eligibilityAssessment?: EligibilityAssessmentOutput },
): AppointmentCreatedResponse {
  const response: AppointmentCreatedResponse = toAppointmentResponse(created);
  if (created.eligibilityAssessment) response.eligibilityAssessment = created.eligibilityAssessment;
  return response;
}
