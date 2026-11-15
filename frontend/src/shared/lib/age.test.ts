import { describe, expect, it } from 'vitest'
import { ageFromBirthDate, declarationsForAge } from './age'

describe('ageFromBirthDate', () => {
  const today = new Date(2026, 9, 30) // 30/10/2026, horário local

  it('conta os anos completos, mudando só no dia do aniversário', () => {
    expect(ageFromBirthDate('2008-10-31', today)).toBe(17)
    expect(ageFromBirthDate('2008-10-30', today)).toBe(18)
  })

  it('devolve null para data incompleta ou em outro formato', () => {
    expect(ageFromBirthDate('', today)).toBeNull()
    expect(ageFromBirthDate('30/10/2008', today)).toBeNull()
  })
})

describe('declarationsForAge', () => {
  it.each([
    [17, { guardian: true, donatedBefore60: false, regularDonor: false }],
    [30, { guardian: false, donatedBefore60: false, regularDonor: false }],
    [60, { guardian: false, donatedBefore60: true, regularDonor: false }],
    [70, { guardian: false, donatedBefore60: true, regularDonor: true }],
    [null, { guardian: false, donatedBefore60: false, regularDonor: false }],
  ])('aos %s anos', (age, expected) => {
    expect(declarationsForAge(age)).toEqual(expected)
  })
})
