import type { UpdateMePayload } from '@/features/auth'
import type { UpdateProfilePayload } from '@/features/eligibility/api/eligibility.api'
import type { UpdateProfileFormValues } from '@/features/eligibility/schemas'
import { onlyDigits } from '@/shared/lib/masks'
import type { DonorResponseDto } from '@/shared/types'

export interface ProfileChanges {
  /** Nome e e-mail: vão para a conta (PATCH /auth/me). */
  account: UpdateMePayload | null
  /** O resto: vai para o perfil de doador (PATCH /donors/:id). */
  donor: UpdateProfilePayload | null
}

/**
 * Compara o formulário com o perfil atual e separa o que mudou por destino. Campos iguais não são
 * enviados. O tipo sanguíneo e a última doação não podem ser apagados (só trocados), então deixá-los
 * em branco não muda nada; o telefone em branco apaga o telefone.
 */
export function profileChanges(values: UpdateProfileFormValues, current: DonorResponseDto): ProfileChanges {
  const account: UpdateMePayload = {}
  if (values.completeName !== current.completeName) account.name = values.completeName
  if (values.email.toLowerCase() !== current.email.toLowerCase()) {
    account.email = values.email
    account.currentPassword = values.currentPassword ?? ''
  }

  const donor: UpdateProfilePayload = {}
  if (values.cpf !== current.cpf) donor.cpf = values.cpf
  if (values.birthDate !== current.birthDate.slice(0, 10)) donor.birthDate = values.birthDate
  if (values.sex !== current.sex) donor.sex = values.sex
  const phone = values.phone || null
  const currentPhone = current.phone ? onlyDigits(current.phone) : null
  if (phone !== currentPhone) donor.phone = phone
  if (values.weightKg !== Number(current.weightKg)) donor.weightKg = values.weightKg
  if (values.bloodType && values.bloodType !== current.bloodType) donor.bloodType = values.bloodType
  if (values.lastDonationDate && values.lastDonationDate !== current.lastDonationAt?.slice(0, 10)) {
    donor.lastDonationDate = values.lastDonationDate
  }

  return {
    account: Object.keys(account).length > 0 ? account : null,
    donor: Object.keys(donor).length > 0 ? donor : null,
  }
}
