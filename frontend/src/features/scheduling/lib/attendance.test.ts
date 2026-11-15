import { describe, expect, it } from 'vitest'
import {
  awaitingConfirmation,
  CONFIRMATION_ADVANCE_MS,
  canConfirmAttendance,
  EXPECTED_ATTENDANCE_STATUS,
  isOpenForDonor,
} from './attendance'

const NOW = Date.parse('2026-10-10T12:00:00.000Z')
const inHours = (hours: number) => new Date(NOW + hours * 3_600_000).toISOString()

describe('canConfirmAttendance', () => {
  it('permite confirmar um agendamento apto e ainda no futuro', () => {
    expect(canConfirmAttendance({ status: 'ELIGIBILITY_CONFIRMED', dateTime: inHours(30) }, NOW)).toBe(true)
  })

  it('não permite quando o horário já passou', () => {
    expect(canConfirmAttendance({ status: 'ELIGIBILITY_CONFIRMED', dateTime: inHours(-1) }, NOW)).toBe(false)
  })

  it.each([
    'SCHEDULED',
    'ELIGIBILITY_DENIED',
    'CONFIRMED',
    'CHECKIN_PERFORMED',
    'COMPLETED',
    'CANCELED',
    'NO_SHOW',
  ] as const)('não permite quando o status é %s', (status) => {
    expect(canConfirmAttendance({ status, dateTime: inHours(30) }, NOW)).toBe(false)
  })
})

describe('awaitingConfirmation', () => {
  it('destaca quando faltam 48 h ou menos e o doador ainda não confirmou', () => {
    expect(awaitingConfirmation({ status: 'ELIGIBILITY_CONFIRMED', dateTime: inHours(47) }, NOW)).toBe(true)
    expect(awaitingConfirmation({ status: 'ELIGIBILITY_CONFIRMED', dateTime: inHours(48) }, NOW)).toBe(true)
  })

  it('não destaca antes do pedido de confirmação ser enviado (mais de 48 h)', () => {
    expect(awaitingConfirmation({ status: 'ELIGIBILITY_CONFIRMED', dateTime: inHours(49) }, NOW)).toBe(false)
  })

  it('não destaca quem já confirmou nem agendamentos que já passaram', () => {
    expect(awaitingConfirmation({ status: 'CONFIRMED', dateTime: inHours(10) }, NOW)).toBe(false)
    expect(awaitingConfirmation({ status: 'ELIGIBILITY_CONFIRMED', dateTime: inHours(-2) }, NOW)).toBe(false)
  })

  it('usa a mesma janela de 48 h do back-end', () => {
    expect(CONFIRMATION_ADVANCE_MS).toBe(48 * 60 * 60 * 1000)
  })
})

describe('EXPECTED_ATTENDANCE_STATUS', () => {
  it('inclui os dois status em que o doador é esperado na unidade', () => {
    expect(EXPECTED_ATTENDANCE_STATUS).toEqual(['ELIGIBILITY_CONFIRMED', 'CONFIRMED'])
  })
})

describe('isOpenForDonor', () => {
  it('em aberto: aguardando até o fim do dia do agendamento, ou com check-in feito', () => {
    expect(isOpenForDonor({ status: 'CONFIRMED', dateTime: inHours(5) }, NOW)).toBe(true)
    // NOW é 09:00 em Brasília: 1 h atrás ainda é hoje, e o check-in vale o dia todo.
    expect(isOpenForDonor({ status: 'ELIGIBILITY_CONFIRMED', dateTime: inHours(-1) }, NOW)).toBe(true)
    expect(isOpenForDonor({ status: 'CHECKIN_PERFORMED', dateTime: inHours(-1) }, NOW)).toBe(true)
  })

  it('não prende o doador: dia do agendamento já passou sem check-in, ou agendamento encerrado', () => {
    expect(isOpenForDonor({ status: 'ELIGIBILITY_CONFIRMED', dateTime: inHours(-10) }, NOW)).toBe(false)
    expect(isOpenForDonor({ status: 'CANCELED', dateTime: inHours(5) }, NOW)).toBe(false)
    expect(isOpenForDonor({ status: 'ELIGIBILITY_DENIED', dateTime: inHours(5) }, NOW)).toBe(false)
  })
})
