import { type DonorOutput, toDonorOutput } from '../dto';
import { CLOCK, Clock } from '@shared/application/ports';
import { toDateISO } from '../../domain/services/dates';
import { validateDonationDate } from '../../domain/services/record-donation';
import { DONOR_REPOSITORY, type DonorRepository } from '../ports/donor.repository';
import { loadDonorOrFail } from './shared/load-donor';

/**
 * Chamado pelo scheduling-service quando um agendamento é concluído. Idempotente: grava a data
 * informada (ou hoje) em `lastDonationAt`, mas nunca recua uma data mais recente - repetir a
 * chamada (retry do outbox) ou processar um evento atrasado não altera o resultado.
 */
export class CompleteDonationUseCase {
  static readonly inject = [DONOR_REPOSITORY, CLOCK] as const;

  constructor(
    private readonly donors: DonorRepository,
    private readonly clock: Clock,
  ) {}

  async execute(donorId: string, donationDate?: string): Promise<DonorOutput> {
    const todayISO = toDateISO(this.clock.now());
    validateDonationDate(donationDate, todayISO);
    const donor = await loadDonorOrFail(this.donors, donorId);
    if (!donor.registerDonationCompleted(donationDate, todayISO)) {
      return toDonorOutput(donor);
    }
    return toDonorOutput(await this.donors.save(donor));
  }
}
