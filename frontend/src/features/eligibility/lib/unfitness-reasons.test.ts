import { describe, expect, it } from 'vitest'
import { expectedEndFor, PERMANENT_REASONS, TEMPORARY_REASONS } from './unfitness-reasons'

describe('expectedEndFor', () => {
  it('em dias: o último dia é a véspera da liberação', () => {
    // 7 dias a partir de 05/11 libera em 12/11.
    expect(expectedEndFor('2026-11-05', { days: 7 })).toBe('2026-11-11')
  })

  it('em meses: o último dia é a véspera do mesmo dia, meses depois', () => {
    expect(expectedEndFor('2026-11-05', { months: 12 })).toBe('2027-11-04')
    expect(expectedEndFor('2026-11-05', { months: 3 })).toBe('2027-02-04')
  })

  it('num mês mais curto, a liberação fica no último dia dele', () => {
    // 31/01 + 1 mês = 28/02 (liberação), então o último dia é 27/02.
    expect(expectedEndFor('2026-01-31', { months: 1 })).toBe('2026-02-27')
  })

  it('prazo zero (ex.: bebida alcoólica): só o próprio dia', () => {
    expect(expectedEndFor('2026-11-05', { days: 0 })).toBe('2026-11-05')
  })
})

describe('listas de motivos', () => {
  it('não repetem identificadores nem textos', () => {
    expect(new Set(TEMPORARY_REASONS.map((r) => r.id)).size).toBe(TEMPORARY_REASONS.length)
    expect(new Set(TEMPORARY_REASONS.map((r) => r.label)).size).toBe(TEMPORARY_REASONS.length)
    expect(new Set(PERMANENT_REASONS).size).toBe(PERMANENT_REASONS.length)
  })

  it('cabem no limite de 255 caracteres do motivo', () => {
    for (const label of [...TEMPORARY_REASONS.map((r) => r.label), ...PERMANENT_REASONS]) {
      expect(label.length).toBeLessThanOrEqual(255)
    }
  })
})
