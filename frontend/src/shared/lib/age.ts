import { formatDate } from '@/shared/lib/format'

/** Idade acima da qual a data de nascimento é tratada como erro de digitação (igual ao backend). */
export const MAX_PLAUSIBLE_AGE_YEARS = 120

/** Idade em anos completos na data de hoje (local do navegador), a partir de uma data AAAA-MM-DD. */
export function ageFromBirthDate(birthDate: string, today: Date = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate)
  if (!match) return null
  const [, year, month, day] = match.map(Number)
  const currentMonth = today.getMonth() + 1
  const hadBirthday = currentMonth > month || (currentMonth === month && today.getDate() >= day)
  return today.getFullYear() - year - (hadBirthday ? 0 : 1)
}

/** Data de nascimento com a idade ao lado, ex.: "17/09/2003 · 23 anos". */
export function formatBirthDateWithAge(birthDate: string, today: Date = new Date()): string {
  const age = ageFromBirthDate(birthDate.slice(0, 10), today)
  return age === null ? formatDate(birthDate) : `${formatDate(birthDate)} · ${age} anos`
}

/**
 * O que o doador precisa declarar conforme a idade (mesma regra do backend): menores de 18 informam
 * o responsável legal; a partir dos 60, se já doaram antes dos 60; a partir dos 70, se são regulares.
 */
export function declarationsForAge(age: number | null) {
  return {
    guardian: age !== null && age < 18,
    donatedBefore60: age !== null && age >= 60,
    regularDonor: age !== null && age >= 70,
  }
}
