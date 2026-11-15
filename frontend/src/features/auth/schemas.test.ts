import { describe, expect, it } from 'vitest'
import {
  forgotPasswordSchema,
  loginSchema,
  registerAdminSchema,
  registerDonorSchema,
  resetPasswordSchema,
} from './schemas'

describe('loginSchema', () => {
  it('aceita um e-mail e senha válidos', () => {
    const result = loginSchema.safeParse({ email: 'donor@example.com', password: '123456' })
    expect(result.success).toBe(true)
  })

  it('rejeita um e-mail inválido', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: '123456' })
    expect(result.success).toBe(false)
  })

  it('rejeita senha vazia', () => {
    const result = loginSchema.safeParse({ email: 'donor@example.com', password: '' })
    expect(result.success).toBe(false)
  })
})

describe('registerDonorSchema', () => {
  const base = {
    name: 'Fulano de Tal',
    email: 'fulano@example.com',
    password: 'password1234',
    confirmPassword: 'password1234',
    cpf: '12345678909',
    birthDate: '1995-04-12',
    sex: 'M' as const,
    weightKg: 70,
    healthDataConsent: true,
  }

  it('recusa data de nascimento no futuro ou de mais de 120 anos', () => {
    expect(registerDonorSchema.safeParse({ ...base, birthDate: '2999-01-01' }).success).toBe(false)
    expect(registerDonorSchema.safeParse({ ...base, birthDate: '1890-01-01' }).success).toBe(false)
  })

  it('aceita um cadastro válido e envia o consentimento, sem a confirmação de senha', () => {
    const result = registerDonorSchema.safeParse(base)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.healthDataConsent).toBe(true)
      expect(result.data).not.toHaveProperty('confirmPassword')
      expect(result.data).not.toHaveProperty('bloodType')
    }
  })

  it('recusa o cadastro sem o consentimento para os dados de saúde', () => {
    expect(registerDonorSchema.safeParse({ ...base, healthDataConsent: false }).success).toBe(false)
    expect(registerDonorSchema.safeParse({ ...base, healthDataConsent: undefined }).success).toBe(false)
  })

  it('recusa quando a confirmação não bate com a senha', () => {
    expect(registerDonorSchema.safeParse({ ...base, confirmPassword: 'outra-senha' }).success).toBe(false)
  })

  it('envia o telefone só quando informado, só com os dígitos', () => {
    const result = registerDonorSchema.safeParse({ ...base, phone: '(55) 99161-6163' })
    expect(result.success && result.data.phone).toBe('55991616163')
    const blank = registerDonorSchema.safeParse({ ...base, phone: '' })
    expect(blank.success && 'phone' in blank.data).toBe(false)
    expect(registerDonorSchema.safeParse({ ...base, phone: '9916-1616' }).success).toBe(false)
  })

  it('envia o tipo sanguíneo só quando informado', () => {
    const result = registerDonorSchema.safeParse({ ...base, bloodType: 'O-' })
    expect(result.success && result.data.bloodType).toBe('O-')
    const unknown = registerDonorSchema.safeParse({ ...base, bloodType: '' })
    expect(unknown.success && 'bloodType' in unknown.data).toBe(false)
  })

  it('rejeita CPF com dígito verificador errado', () => {
    const result = registerDonorSchema.safeParse({ ...base, cpf: '12345678901' })
    expect(result.success).toBe(false)
  })

  it('aceita CPF com pontuação (máscara) e envia só os dígitos', () => {
    const result = registerDonorSchema.safeParse({ ...base, cpf: '123.456.789-09' })
    expect(result.success && result.data.cpf).toBe('12345678909')
  })

  it('rejeita senha curta', () => {
    const result = registerDonorSchema.safeParse({ ...base, password: '123', confirmPassword: '123' })
    expect(result.success).toBe(false)
  })
})

describe('registerAdminSchema', () => {
  it('aceita dados válidos', () => {
    const result = registerAdminSchema.safeParse({
      name: 'Admin Um',
      email: 'admin@example.com',
      password: 'passwordAdmin123',
      confirmPassword: 'passwordAdmin123',
    })
    expect(result.success).toBe(true)
    // A confirmação não vai para o servidor.
    expect(result.data).toEqual({ name: 'Admin Um', email: 'admin@example.com', password: 'passwordAdmin123' })
  })

  it('rejeita quando a confirmação não bate com a senha', () => {
    const result = registerAdminSchema.safeParse({
      name: 'Admin Um',
      email: 'admin@example.com',
      password: 'passwordAdmin123',
      confirmPassword: 'outraSenha123',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['confirmPassword'])
  })
})

describe('forgotPasswordSchema', () => {
  it('aceita um e-mail válido', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'donor@example.com' }).success).toBe(true)
  })

  it('rejeita um e-mail inválido', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'not-an-email' }).success).toBe(false)
  })
})

describe('resetPasswordSchema', () => {
  const base = { token: 'token-123', newPassword: 'new12345', confirmPassword: 'new12345' }

  it('aceita quando a confirmação bate com a nova senha', () => {
    expect(resetPasswordSchema.safeParse(base).success).toBe(true)
  })

  it('rejeita quando a confirmação não bate com a nova senha', () => {
    const result = resetPasswordSchema.safeParse({ ...base, confirmPassword: 'other-password' })
    expect(result.success).toBe(false)
  })

  it('rejeita senha curta', () => {
    const result = resetPasswordSchema.safeParse({
      ...base,
      newPassword: '123',
      confirmPassword: '123',
    })
    expect(result.success).toBe(false)
  })

  it('rejeita senha acima de 72 bytes (acentos contam mais de um byte)', () => {
    const long = 'ç'.repeat(40)
    expect(resetPasswordSchema.safeParse({ ...base, newPassword: long, confirmPassword: long }).success).toBe(false)
    const limit = 'a'.repeat(72)
    expect(resetPasswordSchema.safeParse({ ...base, newPassword: limit, confirmPassword: limit }).success).toBe(true)
  })

  it('rejeita token vazio', () => {
    expect(resetPasswordSchema.safeParse({ ...base, token: '' }).success).toBe(false)
  })
})
