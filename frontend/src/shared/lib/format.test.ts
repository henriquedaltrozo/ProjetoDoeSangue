import { describe, expect, it } from 'vitest'
import {
  addDaysISO,
  businessDate,
  businessDateTimeToISO,
  businessTime,
  formatCpf,
  formatDate,
  formatDateTime,
  toDateInputValue,
} from './format'

describe('formatCpf', () => {
  it('formata um CPF de 11 dígitos com pontuação', () => {
    expect(formatCpf('12345678901')).toBe('123.456.789-01')
  })
})

describe('formatDate', () => {
  it('formata uma data "YYYY-MM-DD" sem deslocar um dia para trás', () => {
    // Regressão: interpretar "2026-09-15" como meio-dia UTC evita cair para
    // 14/09 em fusos horários negativos (ex.: America/Sao_Paulo).
    expect(formatDate('2026-09-15')).toBe('15/09/2026')
  })

  it('formata um datetime ISO completo', () => {
    // Horário longe da meia-noite de propósito, para o teste não depender
    // do fuso horário de quem o executa.
    expect(formatDate('2026-09-15T14:30:00.000Z')).toMatch(/\d{2}\/\d{2}\/2026/)
  })
})

describe('formatDateTime', () => {
  it('formata um datetime ISO com data e hora', () => {
    const result = formatDateTime('2026-09-15T14:30:00.000Z')
    expect(result).toContain('2026')
  })
})

describe('toDateInputValue', () => {
  it('usa a data local, não a data em UTC', () => {
    // 23h30 no horário local: em fusos negativos, toISOString() já cairia no dia seguinte.
    expect(toDateInputValue(new Date(2026, 9, 29, 23, 30))).toBe('2026-10-29')
  })

  it('completa mês e dia com zero à esquerda', () => {
    expect(toDateInputValue(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('horário de Brasília', () => {
  // 02:30 UTC de 11/10 ainda é 23:30 de 10/10 em Brasília (UTC-3).
  const instant = new Date('2026-10-11T02:30:00.000Z')

  it('dia e hora no fuso do hemocentro, qualquer que seja o do navegador', () => {
    expect(businessDate(instant)).toBe('2026-10-10')
    expect(businessTime(instant)).toBe('23:30')
    expect(formatDateTime(instant.toISOString())).toContain('23:30')
  })

  it('monta o instante de um dia e hora de Brasília', () => {
    expect(businessDateTimeToISO('2026-10-10', '14:00')).toBe('2026-10-10T17:00:00.000Z')
  })

  it('soma dias atravessando mês e ano', () => {
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01')
  })
})
