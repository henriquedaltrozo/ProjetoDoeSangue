import { AppointmentStatus } from '../enums';

/** Status que efetivamente ocupam uma vaga na unidade/horário. */
export const SLOT_OCCUPYING_STATES: AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.ELIGIBILITY_CONFIRMED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKIN_PERFORMED,
  AppointmentStatus.COMPLETED,
];

/** Os horários de agendamento são de 30 em 30 minutos (08:00, 08:30...); a vaga é por horário. */
export const SLOT_MINUTES = 30;

/**
 * Antecedência máxima de um agendamento, em dias (pelo dia de Brasília). Sem limite, um doador
 * poderia marcar para daqui a anos e ficar preso a um agendamento "em aberto" que não vai acontecer.
 */
export const MAX_DAYS_AHEAD = 90;

/**
 * Máximo de agendamentos devolvidos na lista do admin. A tela filtra por dia; sem o filtro, mostra
 * os mais recentes até este limite em vez de carregar o histórico inteiro.
 */
export const ADMIN_LIST_LIMIT = 500;

export const REMINDER_ADVANCE_HOURS = 24;

/**
 * Antecedência do pedido de confirmação de presença: cedo o bastante para o
 * hemocentro agir sobre quem não confirmou (ligar, reorganizar a agenda) e
 * perto o bastante para o doador não esquecer. O lembrete de 24 h reforça o
 * pedido para quem ainda não confirmou.
 */
export const CONFIRMATION_ADVANCE_HOURS = 48;

/** Status em que o doador ainda pode confirmar presença e o admin pode fazer check-in. */
export const STATES_WITH_EXPECTED_ATTENDANCE: AppointmentStatus[] = [
  AppointmentStatus.ELIGIBILITY_CONFIRMED,
  AppointmentStatus.CONFIRMED,
];
