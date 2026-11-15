import { describe, expect, it } from 'vitest'
import { formatPhone, maskCpf, maskPhone, maskUf, normalizeDonorSearch, onlyDigits } from './masks'

describe('máscaras', () => {
  it('onlyDigits remove tudo que não é dígito', () => {
    expect(onlyDigits('037.651.570-82')).toBe('03765157082')
    expect(onlyDigits('(55) 99161-6163')).toBe('55991616163')
  })

  it('maskCpf formata aos poucos e corta em 11 dígitos', () => {
    expect(maskCpf('037')).toBe('037')
    expect(maskCpf('0376')).toBe('037.6')
    expect(maskCpf('0376515')).toBe('037.651.5')
    expect(maskCpf('03765157082')).toBe('037.651.570-82')
    expect(maskCpf('037.651.570-829')).toBe('037.651.570-82')
  })

  it('maskPhone formata fixo e celular', () => {
    expect(maskPhone('')).toBe('')
    expect(maskPhone('5')).toBe('(5')
    expect(maskPhone('559916')).toBe('(55) 9916')
    expect(maskPhone('5532221111')).toBe('(55) 3222-1111')
    expect(maskPhone('55991616163')).toBe('(55) 99161-6163')
  })

  it('maskUf deixa só 2 letras maiúsculas', () => {
    expect(maskUf('rs')).toBe('RS')
    expect(maskUf('s1p')).toBe('SP')
    expect(maskUf('rss')).toBe('RS')
  })

  it('normalizeDonorSearch tira a pontuação de um CPF e mantém um nome', () => {
    expect(normalizeDonorSearch('037.651.570-82')).toBe('03765157082')
    expect(normalizeDonorSearch('037.651')).toBe('037651')
    expect(normalizeDonorSearch('Maria da Silva')).toBe('Maria da Silva')
  })

  it('formatPhone exibe o telefone guardado; fora do padrão, como está', () => {
    expect(formatPhone('55991616163')).toBe('(55) 99161-6163')
    expect(formatPhone('12345678')).toBe('12345678')
  })
})
