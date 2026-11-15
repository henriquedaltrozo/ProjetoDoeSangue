import { describe, expect, it } from 'vitest'
import { slotTimes, upcomingSlots } from './slots'

describe('slotTimes', () => {
  it('sem horário de funcionamento, oferece das 07:00 às 18:30 de 30 em 30 minutos', () => {
    const times = slotTimes(null, '2026-09-14')
    expect(times[0]).toBe('07:00')
    expect(times[1]).toBe('07:30')
    expect(times.at(-1)).toBe('18:30')
  })

  it('usa as faixas do dia da semana (o fim não entra)', () => {
    // 2026-09-14 é segunda-feira.
    expect(slotTimes({ seg: ['08:00-10:00', '13:00-14:00'] }, '2026-09-14')).toEqual([
      '08:00',
      '08:30',
      '09:00',
      '09:30',
      '13:00',
      '13:30',
    ])
  })

  it('aceita o dia com acento e devolve vazio quando a unidade não atende', () => {
    expect(slotTimes({ sáb: ['08:00-09:00'] }, '2026-09-19')).toEqual(['08:00', '08:30'])
    expect(slotTimes({ sáb: ['08:00-09:00'] }, '2026-09-14')).toEqual([])
  })
})

describe('upcomingSlots', () => {
  const slots = ['08:00', '08:30', '09:00']

  it('hoje, tira os horários que já passaram (inclusive o atual)', () => {
    expect(upcomingSlots(slots, '2026-10-10', '2026-10-10', '08:30')).toEqual(['09:00'])
  })

  it('outro dia futuro mantém todos; dia passado não tem nenhum', () => {
    expect(upcomingSlots(slots, '2026-10-11', '2026-10-10', '23:00')).toEqual(slots)
    expect(upcomingSlots(slots, '2026-10-09', '2026-10-10', '07:00')).toEqual([])
  })
})
