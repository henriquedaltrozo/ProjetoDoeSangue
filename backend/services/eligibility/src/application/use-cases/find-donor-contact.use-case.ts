import type { DonorRecipientOutput } from '@shared/application/dto';
import { DONOR_REPOSITORY, type DonorRepository } from '../ports/donor.repository';
import { loadDonorOrFail } from './shared/load-donor';

/**
 * [interno] Nome e e-mail de um doador, para um aviso individual por e-mail (ex.: agendamento
 * cancelado). Não traz dado de saúde. `active` falso indica conta excluída: não há a quem avisar.
 */
export class FindDonorContactUseCase {
  static readonly inject = [DONOR_REPOSITORY] as const;

  constructor(private readonly donors: DonorRepository) {}

  async execute(donorId: string): Promise<DonorRecipientOutput> {
    const donor = await loadDonorOrFail(this.donors, donorId);
    return {
      id: donor.id,
      completeName: donor.completeName,
      email: donor.email,
      active: donor.active,
    };
  }
}
