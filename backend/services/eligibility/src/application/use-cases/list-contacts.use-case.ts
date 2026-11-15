import type { DonorContactOutput } from '@shared/application/dto';
import { CLOCK, type Clock } from '@shared/application/ports';
import { type BloodType, EligibilityResult } from '@shared/domain/enums';
import { assessEligibility } from '../../domain/services/assess-eligibility';
import { toDateISO } from '../../domain/services/dates';
import { DONOR_REPOSITORY, type DonorRepository } from '../ports/donor.repository';
import { UNFITNESS_REPOSITORY, type UnfitnessRepository } from '../ports/unfitness.repository';

/**
 * [interno] Contatos dos doadores que podem doar hoje e aceitam avisos por e-mail (ativos e aptos pelo motor de elegibilidade:
 * sem inaptidão permanente ou temporária em vigor e com o intervalo mínimo cumprido), opcionalmente
 * de um tipo sanguíneo. Usado pelo scheduling-service para avisar sobre campanhas urgentes: avisar
 * quem não pode doar só gera frustração.
 */
export class ListContactsUseCase {
  static readonly inject = [DONOR_REPOSITORY, UNFITNESS_REPOSITORY, CLOCK] as const;

  constructor(
    private readonly donors: DonorRepository,
    private readonly unfitness: UnfitnessRepository,
    private readonly clock: Clock,
  ) {}

  async execute(bloodType?: BloodType): Promise<DonorContactOutput[]> {
    const now = this.clock.now();
    const donors = await this.donors.listAcceptingAlerts(bloodType);
    const active = await this.unfitness.listActiveForDonors(
      donors.map((d) => d.id),
      toDateISO(now),
    );
    const activeByDonor = new Map(active.map((u) => [u.donorId, u]));

    return donors
      .filter(
        (donor) =>
          assessEligibility({ donor, activeUnfitness: activeByDonor.get(donor.id) ?? null, now })
            .result === EligibilityResult.ELIGIBLE,
      )
      .map((d) => ({
        id: d.id,
        completeName: d.completeName,
        email: d.email,
        phone: d.phone,
        bloodType: d.bloodType,
      }));
  }
}
