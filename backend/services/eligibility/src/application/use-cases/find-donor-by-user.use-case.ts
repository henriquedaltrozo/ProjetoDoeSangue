import { type DonorOutput, toDonorOutput } from '../dto';
import { NotFoundError } from '../errors/application.errors';
import { DONOR_REPOSITORY, type DonorRepository } from '../ports/donor.repository';

export class FindDonorByUserUseCase {
  static readonly inject = [DONOR_REPOSITORY] as const;

  constructor(private readonly donors: DonorRepository) {}

  async execute(userId: string): Promise<DonorOutput> {
    const donor = await this.donors.findByUserId(userId);
    if (!donor) {
      throw new NotFoundError('Doador não encontrado para este usuário.');
    }
    return toDonorOutput(donor);
  }
}
