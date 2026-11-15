import {
  MAX_AGE_FIRST_DONATION_YEARS,
  MEDICAL_CLEARANCE_VALIDITY_MONTHS,
} from '../rules/eligibility-rules.constants';
import { addDays, addMonths, birthdayAt } from './dates';

/** Data (AAAA-MM-DD) do aniversário de 60 anos: doações antes dela contam como "antes dos 60". */
export function sixtiethBirthday(birthDateISO: string): string {
  return birthdayAt(birthDateISO, MAX_AGE_FIRST_DONATION_YEARS);
}

/** A doação da data informada foi feita antes dos 60 anos de quem nasceu em `birthDateISO`. */
export function isBeforeSixty(birthDateISO: string, donationDateISO: string): boolean {
  return donationDateISO < sixtiethBirthday(birthDateISO);
}

/**
 * Já doou antes dos 60: declarado pelo doador ou com uma doação conhecida anterior ao aniversário de
 * 60 anos. Uma doação feita depois dos 60 não prova nada sozinha (e não desfaz um "não" declarado).
 */
export function hasDonatedBefore60(donor: {
  birthDate: string;
  donatedBefore60: boolean | null;
  lastDonationAt: string | null;
  donationDates: string[];
}): boolean {
  if (donor.donatedBefore60 === true) return true;
  const known = [...donor.donationDates, ...(donor.lastDonationAt ? [donor.lastDonationAt] : [])];
  return known.some((date) => isBeforeSixty(donor.birthDate, date));
}

/** Último dia (AAAA-MM-DD) em que vale a avaliação médica registrada em `clearanceAt`. */
export function medicalClearanceValidUntil(clearanceAt: string): string {
  return addDays(addMonths(clearanceAt, MEDICAL_CLEARANCE_VALIDITY_MONTHS), -1);
}

/** A avaliação médica existe e ainda vale no dia informado. */
export function isMedicalClearanceValid(clearanceAt: string | null, dayISO: string): boolean {
  return clearanceAt !== null && dayISO <= medicalClearanceValidUntil(clearanceAt);
}
