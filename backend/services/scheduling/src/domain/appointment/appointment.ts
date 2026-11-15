import { AppointmentStatus } from '../enums';
import { BusinessRuleError, InvalidValueError } from '../errors';
import {
  MAX_DAYS_AHEAD,
  SLOT_MINUTES,
  STATES_WITH_EXPECTED_ATTENDANCE,
  SLOT_OCCUPYING_STATES,
} from './appointments.constants';
import type { AssessmentNotice } from '@shared/domain/enums';
import { toBusinessDate } from '@shared/domain/time';

export interface AppointmentProps {
  id: string;
  /** Referência lógica a eligibility.donors.id - sem FK entre schemas. */
  donorId: string;
  collectionUnitId: string;
  campaignId: string | null;
  dateTime: Date;
  status: AppointmentStatus;
  /** Referência lógica a eligibility.eligibility_assessments.id. */
  assessmentEligibilityId: string | null;
  /**
   * Avisos da avaliação que confirmou o agendamento (ex.: menor de 18 deve levar o termo do
   * responsável), para a unidade conferir no check-in e o lembrete repetir. Ausente equivale a vazio.
   */
  eligibilityNotices?: AssessmentNotice[];
  cancellationReason: string | null;
  /** Quando o doador (ou um admin) confirmou a presença; nulo enquanto não confirmou. */
  confirmedAt: Date | null;
  checkinAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /** Versão para controle de concorrência otimista: muda a cada gravação. */
  version: number;
}

/** Appointment ainda não persistido (o id e os carimbos de data nascem na persistência). */
export interface NewAppointment {
  donorId: string;
  collectionUnitId: string;
  campaignId: string | null;
  dateTime: Date;
  status: AppointmentStatus;
}

export interface NewAppointmentData {
  donorId: string;
  collectionUnitId: string;
  campaignId?: string | null;
  dateTime: Date;
}

/**
 * Agregado Appointment e a sua máquina de estados:
 *
 *   SCHEDULED -> ELIGIBILITY_CONFIRMED | ELIGIBILITY_DENIED
 *   ELIGIBILITY_CONFIRMED -> CONFIRMED (presença) -> CHECKIN_PERFORMED -> COMPLETED
 *   ELIGIBILITY_CONFIRMED | CONFIRMED -> NO_SHOW (horário já passou)
 *   qualquer status, exceto COMPLETED e CANCELED -> CANCELED
 *
 * Os campos são somente leitura: as mudanças de estado passam sempre pelos
 * métodos de transição, que validam as invariantes, e a saída para a API é
 * montada pelos DTOs de saída e presenters. O relógio vem de fora (`now`) para
 * o domínio ficar puro.
 */
export class Appointment implements AppointmentProps {
  readonly id: string;
  readonly donorId: string;
  readonly collectionUnitId: string;
  readonly campaignId: string | null;
  readonly dateTime: Date;
  readonly status: AppointmentStatus;
  readonly assessmentEligibilityId: string | null;
  readonly eligibilityNotices: AssessmentNotice[];
  readonly cancellationReason: string | null;
  readonly confirmedAt: Date | null;
  readonly checkinAt: Date | null;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;

  constructor(props: AppointmentProps) {
    Object.assign(this, props);
    this.eligibilityNotices = props.eligibilityNotices ?? [];
  }

  /**
   * Cria um agendamento novo (SCHEDULED). A data/hora precisa ser válida, futura e cair num horário
   * da grade (de SLOT_MINUTES em SLOT_MINUTES minutos): como a capacidade da unidade vale por
   * horário, aceitar qualquer minuto deixaria lotar 14:00 e ainda agendar 14:05.
   */
  static draft(data: NewAppointmentData, now: Date): NewAppointment {
    if (Number.isNaN(data.dateTime.getTime()) || data.dateTime.getTime() <= now.getTime()) {
      throw new InvalidValueError('A data/hora do agendamento deve ser válida e estar no futuro.');
    }
    // O fuso de Brasília tem deslocamento de horas inteiras: alinhar em UTC é alinhar no horário local.
    if (
      data.dateTime.getUTCMinutes() % SLOT_MINUTES !== 0 ||
      data.dateTime.getUTCSeconds() !== 0 ||
      data.dateTime.getUTCMilliseconds() !== 0
    ) {
      throw new InvalidValueError(
        `Os horários de agendamento são de ${SLOT_MINUTES} em ${SLOT_MINUTES} minutos (ex.: 08:00, 08:30).`,
      );
    }
    const lastDay = toBusinessDate(new Date(now.getTime() + MAX_DAYS_AHEAD * 24 * 3_600_000));
    if (toBusinessDate(data.dateTime) > lastDay) {
      throw new BusinessRuleError(
        `Os agendamentos podem ser feitos com até ${MAX_DAYS_AHEAD} dias de antecedência.`,
      );
    }
    return {
      donorId: data.donorId,
      collectionUnitId: data.collectionUnitId,
      campaignId: data.campaignId ?? null,
      dateTime: data.dateTime,
      status: AppointmentStatus.SCHEDULED,
    };
  }

  belongsToDonor(donorId: string | null | undefined): boolean {
    return this.donorId === donorId;
  }

  /**
   * Agendamento ainda em aberto para o doador: já fez check-in, ou espera por ele até o fim do dia
   * do agendamento (dia de Brasília). Um doador só pode ter um em aberto por vez. Vale o dia todo,
   * e não só até o horário, porque o check-in também vale o dia todo: o doador que se atrasou ainda
   * pode ser atendido, então não pode marcar outra doação no mesmo dia. No dia seguinte, um
   * agendamento sem check-in nem falta registrada deixa de prender o doador.
   */
  isOpenForDonor(now: Date): boolean {
    if (this.status === AppointmentStatus.CHECKIN_PERFORMED) return true;
    return (
      (this.status === AppointmentStatus.SCHEDULED || this.awaitsAttendance()) &&
      toBusinessDate(this.dateTime) >= toBusinessDate(now)
    );
  }

  /** Ainda antes do check-in (SCHEDULED, ELIGIBILITY_CONFIRMED ou CONFIRMED). */
  awaitsAttendanceOrScheduled(): boolean {
    return this.status === AppointmentStatus.SCHEDULED || this.awaitsAttendance();
  }

  /** Se o agendamento ocupa uma vaga da unidade no horário. */
  occupiesSlot(): boolean {
    return SLOT_OCCUPYING_STATES.includes(this.status);
  }

  /** Se o doador ainda é esperado (pode confirmar presença, fazer check-in ou faltar). */
  awaitsAttendance(): boolean {
    return STATES_WITH_EXPECTED_ATTENDANCE.includes(this.status);
  }

  /** Dia de calendário (AAAA-MM-DD, horário de Brasília) do agendamento. */
  businessDay(): string {
    return toBusinessDate(this.dateTime);
  }

  /** SCHEDULED -> ELIGIBILITY_CONFIRMED (apto) ou ELIGIBILITY_DENIED. */
  registerEligibilityAssessment(
    assessmentId: string,
    eligible: boolean,
    notices: AssessmentNotice[] = [],
  ): void {
    if (this.status !== AppointmentStatus.SCHEDULED) {
      throw new BusinessRuleError('Só é possível avaliar a elegibilidade de agendamentos novos.');
    }
    this.mutate({
      status: eligible
        ? AppointmentStatus.ELIGIBILITY_CONFIRMED
        : AppointmentStatus.ELIGIBILITY_DENIED,
      assessmentEligibilityId: assessmentId,
      eligibilityNotices: eligible ? [...notices] : [],
    });
  }

  /**
   * ELIGIBILITY_CONFIRMED -> CONFIRMED. Idempotente: confirmar de novo
   * devolve `false` sem mexer em nada. Não mexe na vaga: os dois status já a
   * ocupam.
   */
  confirmAttendance(now: Date): boolean {
    if (this.status === AppointmentStatus.CONFIRMED) {
      return false;
    }
    if (this.status !== AppointmentStatus.ELIGIBILITY_CONFIRMED) {
      throw new BusinessRuleError(
        'Só é possível confirmar presença em agendamentos com elegibilidade confirmada.',
      );
    }
    if (this.dateTime.getTime() <= now.getTime()) {
      throw new BusinessRuleError('O horário deste agendamento já passou.');
    }
    this.mutate({ status: AppointmentStatus.CONFIRMED, confirmedAt: now });
    return true;
  }

  /**
   * ELIGIBILITY_CONFIRMED | CONFIRMED -> CHECKIN_PERFORMED. Só no dia do agendamento (horário de
   * Brasília), a qualquer hora dele: o check-in é a chegada do doador à unidade. Antes do dia, a
   * doação ainda não aconteceu; depois, o certo é marcar o não comparecimento.
   */
  makeCheckin(now: Date): void {
    if (!this.awaitsAttendance()) {
      throw new BusinessRuleError('O agendamento não está em um estado que permita check-in.');
    }
    if (toBusinessDate(now) !== this.businessDay()) {
      const [year, month, day] = this.businessDay().split('-');
      throw new BusinessRuleError(
        `O check-in só pode ser feito no dia do agendamento (${day}/${month}/${year}).`,
      );
    }
    this.mutate({ status: AppointmentStatus.CHECKIN_PERFORMED, checkinAt: now });
  }

  /** CHECKIN_PERFORMED -> COMPLETED. */
  complete(now: Date): void {
    if (this.status !== AppointmentStatus.CHECKIN_PERFORMED) {
      throw new BusinessRuleError(
        'O agendamento precisa ter passado por check-in antes de ser concluído.',
      );
    }
    this.mutate({ status: AppointmentStatus.COMPLETED, completedAt: now });
  }

  /**
   * ELIGIBILITY_CONFIRMED | CONFIRMED -> NO_SHOW. Só faz sentido
   * para quem tinha vaga reservada e cujo horário já passou; do contrário o
   * estado correto é cancelar (ainda no futuro) ou check-in/conclusão.
   */
  markNoShow(now: Date): void {
    if (!this.awaitsAttendance()) {
      throw new BusinessRuleError(
        'Só é possível marcar não comparecimento em agendamentos com elegibilidade confirmada.',
      );
    }
    if (this.dateTime.getTime() > now.getTime()) {
      throw new BusinessRuleError(
        'Não é possível marcar não comparecimento antes do horário agendado.',
      );
    }
    this.mutate({ status: AppointmentStatus.NO_SHOW });
  }

  /**
   * -> CANCELED. O doador cancela só antes do horário e antes do check-in (SCHEDULED,
   * ELIGIBILITY_CONFIRMED, CONFIRMED). A equipe (admin) também cancela depois do horário e depois do
   * check-in (ex.: a triagem clínica recusou o doador). Ninguém cancela um agendamento já encerrado
   * (COMPLETED, NO_SHOW, ELIGIBILITY_DENIED, CANCELED): isso apagaria o histórico.
   */
  cancel(now: Date, byStaff: boolean, reason?: string): void {
    const beforeCheckin =
      this.status === AppointmentStatus.SCHEDULED ||
      STATES_WITH_EXPECTED_ATTENDANCE.includes(this.status);
    const cancellable =
      beforeCheckin || (byStaff && this.status === AppointmentStatus.CHECKIN_PERFORMED);
    if (!cancellable) {
      throw new BusinessRuleError('Este agendamento não pode mais ser cancelado.');
    }
    if (!byStaff && this.dateTime.getTime() <= now.getTime()) {
      throw new BusinessRuleError(
        'O horário deste agendamento já passou: ele não pode mais ser cancelado pelo doador.',
      );
    }
    this.mutate({ status: AppointmentStatus.CANCELED, cancellationReason: reason ?? null });
  }

  /** Único ponto de alteração de estado: só os métodos de domínio mudam a entidade. */
  private mutate(changes: Partial<AppointmentProps>): void {
    Object.assign(this, changes);
  }
}
