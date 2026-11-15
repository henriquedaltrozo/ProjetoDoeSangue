import { describe, expect, it } from 'vitest'
import { isValidCpf } from './cpf'

describe('isValidCpf', () => {
  it('aceita um CPF com os dígitos verificadores corretos', () => {
    expect(isValidCpf('12345678909')).toBe(true)
    expect(isValidCpf('52998224725')).toBe(true)
  })

  it('rejeita um CPF com dígito verificador errado', () => {
    expect(isValidCpf('12345678901')).toBe(false)
  })

  it('rejeita sequências repetidas, que passam na conta mas não são CPFs', () => {
    expect(isValidCpf('11111111111')).toBe(false)
  })

  it('rejeita formato diferente de 11 dígitos', () => {
    expect(isValidCpf('123.456.789-09')).toBe(false)
    expect(isValidCpf('1234567890')).toBe(false)
  })
})
