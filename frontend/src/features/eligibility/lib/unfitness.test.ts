import { describe, expect, it } from 'vitest'
import type { TemporaryUnfitnessDto } from '@/shared/types'
import { isUnfitnessActive } from './unfitness'

const base: TemporaryUnfitnessDto = {
  id: 'u1',
  donorId: 'd1',
  reason: 'Tatuagem',
  category: 'OTHER',
  startDate: '2026-10-01',
  expectedEndDate: '2026-10-20',
  actualEndDate: null,
  registeredBy: null,
  createdAt: '2026-10-01T12:00:00.000Z',
}

describe('isUnfitnessActive', () => {
  it('vale do início até o último dia previsto (inclusive)', () => {
    expect(isUnfitnessActive(base, '2026-10-01')).toBe(true)
    expect(isUnfitnessActive(base, '2026-10-20')).toBe(true)
    expect(isUnfitnessActive(base, '2026-10-21')).toBe(false)
  })

  it('ainda não começou', () => {
    expect(isUnfitnessActive(base, '2026-09-30')).toBe(false)
  })

  it('sem fim previsto, vale até ser encerrada; o fim real prevalece', () => {
    expect(isUnfitnessActive({ ...base, expectedEndDate: null }, '2027-05-01')).toBe(true)
    expect(isUnfitnessActive({ ...base, actualEndDate: '2026-10-05' }, '2026-10-06')).toBe(false)
  })

  it('encerrada num dia, o doador já está liberado nesse dia', () => {
    expect(isUnfitnessActive({ ...base, actualEndDate: '2026-10-05' }, '2026-10-04')).toBe(true)
    expect(isUnfitnessActive({ ...base, actualEndDate: '2026-10-05' }, '2026-10-05')).toBe(false)
  })
})
