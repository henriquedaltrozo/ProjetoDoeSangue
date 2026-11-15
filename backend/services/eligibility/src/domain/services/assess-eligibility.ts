import {
  AssessmentNotice,
  IneligibilityReason,
  EligibilityResult,
  Sex,
} from '@shared/domain/enums';
import type { Donor } from '../entities/donor';
import type { TemporaryUnfitness } from '../entities/temporary-unfitness';
import {
  ADULT_AGE_YEARS,
  MAX_AGE_FIRST_DONATION_YEARS,
  MAX_AGE_YEARS,
  MAX_DONATIONS_PER_12_MONTHS_FEMALE,
  MAX_DONATIONS_PER_12_MONTHS_MALE,
  MIN_AGE_YEARS,
  MIN_INTERVAL_MONTHS_FEMALE,
  MIN_INTERVAL_MONTHS_MALE,
  MIN_WEIGHT_KG,
  ANNUAL_WINDOW_MONTHS,
} from '../rules/eligibility-rules.constants';
import { addDays, addMonths, ageOnDate, birthdayAt, toDateISO } from './dates';
import { hasDonatedBefore60, isMedicalClearanceValid } from './age-rules';
import { isWithinAnnualWindow } from './record-donation';

export interface AssessmentEntry {
  donor: Donor;
  /** Inaptidão temporária em vigor no dia da doação (ver effectiveDonationDay), se houver. */
  activeUnfitness: TemporaryUnfitness | null;
  now: Date;
  /**
   * Dia (AAAA-MM-DD) da doação pretendida, quando a avaliação é de um agendamento. As regras de idade
   * e a validade da avaliação médica são conferidas nesse dia: quem agenda com 69 anos para depois
   * do aniversário de 70 doaria com 70. Sem ele (ou se for antes de hoje), vale hoje.
   */
  donationDate?: string;
}

export interface AssessmentResult {
  result: EligibilityResult;
  reasons: IneligibilityReason[];
  nextEligibilityDate: string | null;
  /** Avisos de uma avaliação apta (vazio quando há motivo de inaptidão). */
  notices: AssessmentNotice[];
}

/** Intervalo mínimo (meses) entre doações de sangue total conforme o sexo. */
export function minIntervalMonths(sex: Sex): number {
  return sex === Sex.M ? MIN_INTERVAL_MONTHS_MALE : MIN_INTERVAL_MONTHS_FEMALE;
}

/** Máximo de doações de sangue total em 12 meses conforme o sexo. */
export function maxDonationsPer12Months(sex: Sex): number {
  return sex === Sex.M ? MAX_DONATIONS_PER_12_MONTHS_MALE : MAX_DONATIONS_PER_12_MONTHS_FEMALE;
}

/**
 * Dia em que as regras são conferidas: o da doação agendada, se for depois de hoje; senão, hoje.
 * Quem chama o motor usa o mesmo dia para buscar a inaptidão temporária em vigor.
 */
export function effectiveDonationDay(now: Date, donationDate?: string): string {
  const todayISO = toDateISO(now);
  const day = donationDate?.slice(0, 10);
  return day && day > todayISO ? day : todayISO;
}

/**
 * Motor de regras de elegibilidade: função pura, sem acesso a dados nem ao relógio. Todas as regras
 * (idade, avaliação médica, intervalo mínimo, limite anual e inaptidão temporária) são conferidas no
 * dia da doação: agendar para depois do fim de um intervalo ou de uma inaptidão é permitido.
 */
export function assessEligibility({
  donor,
  activeUnfitness,
  now,
  donationDate,
}: AssessmentEntry): AssessmentResult {
  const donationDay = effectiveDonationDay(now, donationDate);
  const reasons: IneligibilityReason[] = [];
  const nextDateCandidates: string[] = [];
  // Motivo sem data prevista para acabar (peso, declarações, avaliação médica, inaptidão em aberto):
  // não há como prometer uma próxima data.
  let undatedReason = false;
  const notices: AssessmentNotice[] = [];

  if (donor.permanentUnfit) {
    reasons.push(IneligibilityReason.PERMANENT_UNFIT);
  } else {
    const age = ageOnDate(donor.birthDate, donationDay);
    if (age < MIN_AGE_YEARS) {
      reasons.push(IneligibilityReason.AGE_BELOW_MIN);
      // Passa a poder doar no aniversário da idade mínima.
      nextDateCandidates.push(birthdayAt(donor.birthDate, MIN_AGE_YEARS));
    }
    if (age >= MIN_AGE_YEARS && age < ADULT_AGE_YEARS) {
      // Menor de 18: precisa do responsável informado e do termo confirmado; aí doa, levando o termo.
      if (donor.guardianConsentDeclared && donor.guardianName) {
        notices.push(AssessmentNotice.BRING_GUARDIAN_CONSENT);
      } else {
        reasons.push(IneligibilityReason.GUARDIAN_CONSENT_REQUIRED);
        undatedReason = true;
      }
    }
    if (age > MAX_AGE_YEARS) {
      // 70 anos ou mais: só doador regular, com avaliação médica favorável válida no dia da doação.
      if (!donor.regularDonorDeclared) {
        reasons.push(IneligibilityReason.AGE_ABOVE_MAX);
        undatedReason = true;
      } else if (!isMedicalClearanceValid(donor.medicalClearanceAt, donationDay)) {
        reasons.push(IneligibilityReason.MEDICAL_CLEARANCE_REQUIRED);
        undatedReason = true;
      }
    } else if (age >= MAX_AGE_FIRST_DONATION_YEARS && !hasDonatedBefore60(donor)) {
      reasons.push(IneligibilityReason.AGE_ABOVE_MAX_FIRST_DONATION);
      undatedReason = true;
    }
    if (Number(donor.weightKg) < MIN_WEIGHT_KG) {
      reasons.push(IneligibilityReason.INSUFFICIENT_WEIGHT);
      undatedReason = true;
    }

    if (activeUnfitness) {
      reasons.push(IneligibilityReason.ACTIVE_TEMPORARY_UNFITNESS);
      // O período vale até o último dia (inclusive): o doador volta a poder doar no dia seguinte.
      const lastDay = activeUnfitness.lastDay();
      if (lastDay) {
        nextDateCandidates.push(addDays(lastDay, 1));
      } else {
        undatedReason = true;
      }
    }

    if (donor.lastDonationAt) {
      const nextDate = addMonths(donor.lastDonationAt, minIntervalMonths(donor.sex));
      // Conta no dia da doação: quem agenda para depois do fim do intervalo pode doar nesse dia.
      if (nextDate > donationDay) {
        reasons.push(IneligibilityReason.MIN_INTERVAL_NOT_FULFILLED);
        nextDateCandidates.push(nextDate);
      }
    }

    const recentDonations = [
      ...new Set([...donor.donationDates, ...(donor.lastDonationAt ? [donor.lastDonationAt] : [])]),
    ]
      .filter((date) => isWithinAnnualWindow(date, donationDay))
      .sort();
    const limit = maxDonationsPer12Months(donor.sex);
    if (recentDonations.length >= limit) {
      reasons.push(IneligibilityReason.MAX_ANNUAL_DONATIONS_REACHED);
      // Volta a ser possível quando a doação mais antiga que ainda pesa no limite sai da janela de 12 meses.
      nextDateCandidates.push(
        addMonths(recentDonations[recentDonations.length - limit], ANNUAL_WINDOW_MONTHS),
      );
    }
  }

  const result = reasons.includes(IneligibilityReason.PERMANENT_UNFIT)
    ? EligibilityResult.PERMANENT_UNFIT
    : reasons.length > 0
      ? EligibilityResult.TEMPORARY_UNFIT
      : EligibilityResult.ELIGIBLE;

  const sorted = [...nextDateCandidates].sort();
  const nextEligibilityDate =
    result === EligibilityResult.TEMPORARY_UNFIT && !undatedReason && sorted.length > 0
      ? sorted[sorted.length - 1]
      : null;

  return {
    result,
    reasons,
    nextEligibilityDate,
    notices: result === EligibilityResult.ELIGIBLE ? notices : [],
  };
}
