import { describe, expect, it } from 'vitest'
import { createUnitSchema, EMPTY_WEEK_HOURS } from './schemas'

const base = {
  name: 'Unidade Centro',
  address: 'Rua A, 1',
  neighborhood: 'Centro',
  city: 'Ijuí',
  uf: 'rs',
  phone: '5533330000',
  simultaneousCapacity: '3',
}

describe('createUnitSchema', () => {
  it('sem nenhum dia marcado, não envia horário de funcionamento', () => {
    const result = createUnitSchema.parse({ ...base, hours: EMPTY_WEEK_HOURS })
    expect(result).not.toHaveProperty('operatingHours')
    expect(result.uf).toBe('RS')
  })

  it('envia só os dias marcados, no formato do backend', () => {
    const hours = EMPTY_WEEK_HOURS.map((day, i) =>
      i === 1
        ? { open: true, start: '08:00', end: '17:00' }
        : i === 6
          ? { open: true, start: '08:00', end: '12:00' }
          : day,
    )
    expect(createUnitSchema.parse({ ...base, hours }).operatingHours).toEqual({
      seg: ['08:00-17:00'],
      sab: ['08:00-12:00'],
    })
  })

  it('aceita telefone com máscara e envia só os dígitos; recusa sem DDD', () => {
    const hours = EMPTY_WEEK_HOURS
    expect(createUnitSchema.parse({ ...base, phone: '(55) 3333-0000', hours }).phone).toBe('5533330000')
    expect(createUnitSchema.safeParse({ ...base, phone: '3333-0000', hours }).success).toBe(false)
  })

  it('exige o bairro', () => {
    expect(createUnitSchema.safeParse({ ...base, neighborhood: ' ', hours: EMPTY_WEEK_HOURS }).success).toBe(false)
  })

  it('recusa dia marcado com fim antes do início', () => {
    const hours = EMPTY_WEEK_HOURS.map((day, i) => (i === 2 ? { open: true, start: '17:00', end: '08:00' } : day))
    expect(createUnitSchema.safeParse({ ...base, hours }).success).toBe(false)
  })
})
