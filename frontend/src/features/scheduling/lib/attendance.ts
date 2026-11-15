import { businessDate } from '@/shared/lib/format'
import type { AppointmentStatus } from '@/shared/types'

/** Mesma antecedência do pedido de confirmação no back (CONFIRMATION_ADVANCE_HOURS). */
export const CONFIRMATION_ADVANCE_MS = 48 * 3_600_000

interface AppointmentSummary {
  status: AppointmentStatus
  dateTime: string
}

/** O doador (ou o admin por ele) ainda pode confirmar: apto, não confirmado e o horário não passou. */
export function canConfirmAttendance(appointment: AppointmentSummary, nowMs: number): boolean {
  return appointment.status === 'ELIGIBILITY_CONFIRMED' && new Date(appointment.dateTime).getTime() > nowMs
}

/**
 * Appointment que já recebeu o pedido de confirmação (faltam 48 h ou menos) e
 * continua sem resposta: é o que o admin precisa destacar para ligar para o
 * doador. Não é um status novo, é derivado de status + horário.
 */
export function awaitingConfirmation(appointment: AppointmentSummary, nowMs: number): boolean {
  if (!canConfirmAttendance(appointment, nowMs)) {
    return false
  }
  return new Date(appointment.dateTime).getTime() - nowMs <= CONFIRMATION_ADVANCE_MS
}

/** Antecedência máxima de um agendamento, em dias (mesmo limite do back: MAX_DAYS_AHEAD). */
export const MAX_DAYS_AHEAD = 90

/**
 * Agendamento ainda em aberto para o doador (mesma regra do backend): já fez check-in, ou espera por
 * ele até o fim do dia do agendamento (o check-in vale o dia todo). Enquanto houver um, o backend
 * não aceita outro agendamento.
 */
export function isOpenForDonor(appointment: AppointmentSummary, nowMs: number): boolean {
  if (appointment.status === 'CHECKIN_PERFORMED') return true
  const waiting =
    appointment.status === 'SCHEDULED' ||
    appointment.status === 'ELIGIBILITY_CONFIRMED' ||
    appointment.status === 'CONFIRMED'
  return waiting && businessDate(new Date(appointment.dateTime)) >= businessDate(new Date(nowMs))
}

/** Status em que o doador é esperado na unidade: habilitam check-in e não comparecimento. */
export const EXPECTED_ATTENDANCE_STATUS: AppointmentStatus[] = ['ELIGIBILITY_CONFIRMED', 'CONFIRMED']
