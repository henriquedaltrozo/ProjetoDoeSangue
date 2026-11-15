import { ANNUAL_WINDOW_MONTHS } from '../rules/eligibility-rules.constants';
import { DonationDateInFutureError } from '../errors/domain.errors';
import { addMonths } from './dates';

/** A data informada da doação não pode estar no futuro (omitida = hoje, sempre válida). */
export function validateDonationDate(donationDate: string | undefined, todayISO: string): void {
  if (donationDate && donationDate > todayISO) {
    throw new DonationDateInFutureError();
  }
}

/**
 * Regra idempotente de "doação concluída": devolve a nova `lastDonationAt`, ou `null` quando nada
 * deve mudar - uma data igual ou mais antiga que a atual nunca recua o registro (retry do outbox,
 * evento atrasado).
 */
export function calculateLastDonation(
  currentLastDonation: string | null,
  donationDate: string | undefined,
  todayISO: string,
): string | null {
  const date = donationDate ?? todayISO;
  if (currentLastDonation && currentLastDonation >= date) {
    return null;
  }
  return date;
}

/** Uma doação ainda conta no limite de 12 meses enquanto `data + 12 meses` for posterior a hoje. */
export function isWithinAnnualWindow(donationDateISO: string, todayISO: string): boolean {
  return addMonths(donationDateISO, ANNUAL_WINDOW_MONTHS) > todayISO;
}

/** Acrescenta uma doação ao histórico, sem duplicar datas e descartando as que saíram da janela de 12 meses. */
export function appendDonation(
  history: readonly string[],
  donationDateISO: string,
  todayISO: string,
): string[] {
  return [...new Set([...history, donationDateISO])]
    .filter((date) => isWithinAnnualWindow(date, todayISO))
    .sort();
}
