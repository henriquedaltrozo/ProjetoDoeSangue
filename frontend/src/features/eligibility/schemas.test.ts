import { describe, expect, it } from 'vitest'
import { registerUnfitnessSchema, updateDeclarationsSchema, updateProfileSchema } from './schemas'

describe('updateProfileSchema', () => {
  const base = {
    completeName: 'Maria Silva',
    email: 'maria@example.com',
    cpf: '52998224725',
    birthDate: '1990-01-01',
    sex: 'F',
    phone: '',
    weightKg: '60',
    bloodType: '',
    lastDonationDate: '',
  }

  it('aceita o perfil com telefone, tipo sanguíneo e última doação em branco', () => {
    const result = updateProfileSchema.safeParse(base)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.weightKg).toBe(60)
    }
  })

  it('aceita CPF e telefone com máscara e devolve só os dígitos', () => {
    const result = updateProfileSchema.safeParse({ ...base, cpf: '529.982.247-25', phone: '(55) 99161-6163' })
    expect(result.success && result.data.cpf).toBe('52998224725')
    expect(result.success && result.data.phone).toBe('55991616163')
  })

  it('rejeita telefone sem DDD ou incompleto', () => {
    expect(updateProfileSchema.safeParse({ ...base, phone: '99161616' }).success).toBe(false)
  })

  it('rejeita telefone muito curto quando informado', () => {
    expect(updateProfileSchema.safeParse({ ...base, phone: '123' }).success).toBe(false)
  })

  it('rejeita nome curto, e-mail ou CPF inválidos e peso zero', () => {
    expect(updateProfileSchema.safeParse({ ...base, completeName: 'Al' }).success).toBe(false)
    expect(updateProfileSchema.safeParse({ ...base, email: 'sem-arroba' }).success).toBe(false)
    expect(updateProfileSchema.safeParse({ ...base, cpf: '12345678901' }).success).toBe(false)
    expect(updateProfileSchema.safeParse({ ...base, weightKg: '0' }).success).toBe(false)
  })

  it('rejeita nascimento no futuro e última doação no futuro ou antes do nascimento', () => {
    expect(updateProfileSchema.safeParse({ ...base, birthDate: '2999-01-01' }).success).toBe(false)
    expect(updateProfileSchema.safeParse({ ...base, lastDonationDate: '2999-01-01' }).success).toBe(false)
    expect(updateProfileSchema.safeParse({ ...base, lastDonationDate: '1989-01-01' }).success).toBe(false)
  })
})

describe('updateDeclarationsSchema', () => {
  it('não envia o nome do responsável em branco (o backend exige ao menos 3 caracteres)', () => {
    expect(updateDeclarationsSchema.parse({ guardianName: '   ', guardianConsent: false })).toEqual({
      guardianConsent: false,
    })
  })

  it('envia o nome sem espaços nas pontas e converte as respostas sim/não', () => {
    expect(
      updateDeclarationsSchema.parse({ guardianName: ' Maria ', guardianConsent: true, donatedBefore60: 'yes' }),
    ).toEqual({ guardianName: 'Maria', guardianConsent: true, donatedBefore60: true })
  })
})

describe('registerUnfitnessSchema', () => {
  const base = { reason: 'Tatuagem', category: 'OTHER' as const, startDate: '2026-10-10' }

  it('recusa fim previsto anterior ao início', () => {
    expect(registerUnfitnessSchema.safeParse({ ...base, expectedEndDate: '2026-10-09' }).success).toBe(false)
  })

  it('aceita fim no mesmo dia ou depois, e fim em branco', () => {
    expect(registerUnfitnessSchema.safeParse({ ...base, expectedEndDate: '2026-10-10' }).success).toBe(true)
    expect(registerUnfitnessSchema.safeParse({ ...base, expectedEndDate: '' }).success).toBe(true)
  })
})
