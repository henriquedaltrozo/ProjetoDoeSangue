import { describe, expect, it } from 'vitest'
import { profileChanges } from '@/features/eligibility/profile-changes'
import type { UpdateProfileFormValues } from '@/features/eligibility/schemas'
import type { DonorResponseDto } from '@/shared/types'

const current = {
  id: 'd1',
  completeName: 'Maria Silva',
  cpf: '52998224725',
  birthDate: '1990-01-01',
  sex: 'F',
  phone: '11999998888',
  email: 'maria@example.com',
  weightKg: 60,
  bloodType: 'O+',
  lastDonationAt: '2026-05-01',
} as DonorResponseDto

const unchanged: UpdateProfileFormValues = {
  completeName: 'Maria Silva',
  email: 'maria@example.com',
  currentPassword: '',
  cpf: '52998224725',
  birthDate: '1990-01-01',
  sex: 'F',
  phone: '11999998888',
  weightKg: 60,
  bloodType: 'O+',
  lastDonationDate: '2026-05-01',
}

describe('profileChanges', () => {
  it('sem alteração, não envia nada', () => {
    expect(profileChanges(unchanged, current)).toEqual({ account: null, donor: null })
  })

  it('nome e e-mail vão para a conta, com a senha atual; e-mail só muda se não for só maiúscula', () => {
    expect(profileChanges({ ...unchanged, email: 'MARIA@example.com' }, current).account).toBeNull()
    expect(
      profileChanges(
        { ...unchanged, completeName: 'Maria Souza', email: 'nova@example.com', currentPassword: 'x' },
        current,
      ),
    ).toEqual({
      account: { name: 'Maria Souza', email: 'nova@example.com', currentPassword: 'x' },
      donor: null,
    })
  })

  it('o resto vai para o perfil de doador, só o que mudou', () => {
    expect(
      profileChanges(
        { ...unchanged, cpf: '11144477735', sex: 'M', weightKg: 62.5, bloodType: 'A-', lastDonationDate: '2026-08-01' },
        current,
      ),
    ).toEqual({
      account: null,
      donor: { cpf: '11144477735', sex: 'M', weightKg: 62.5, bloodType: 'A-', lastDonationDate: '2026-08-01' },
    })
  })

  it('telefone em branco apaga; tipo sanguíneo e última doação em branco não mudam nada', () => {
    expect(profileChanges({ ...unchanged, phone: '', bloodType: '', lastDonationDate: '' }, current)).toEqual({
      account: null,
      donor: { phone: null },
    })
  })
})
