import { CreateDonorInput } from '@shared/application/dto';
import { CLOCK, type Clock } from '@shared/application/ports';
import { Donor } from '../../domain/entities/donor';
import { type DonorOutput, toDonorOutput } from '../dto';
import { ConflictError } from '../errors/application.errors';
import { DONOR_REPOSITORY, type DonorRepository } from '../ports/donor.repository';

/**
 * [interno] Cria o doador de um usuário recém-cadastrado, com as declarações exigidas para a idade
 * (responsável legal, doação antes dos 60, doador regular) e a última doação informada, se houver.
 */
export class CreateDonorUseCase {
  static readonly inject = [DONOR_REPOSITORY, CLOCK] as const;

  constructor(
    private readonly donors: DonorRepository,
    private readonly clock: Clock,
  ) {}

  async execute(dto: CreateDonorInput): Promise<DonorOutput> {
    const existing = await this.donors.findByCpfOrUserId(dto.cpf, dto.userId);
    if (existing) {
      throw new ConflictError('Já existe um doador cadastrado com este CPF ou usuário.');
    }
    return toDonorOutput(
      await this.donors.create(
        Donor.draft(
          {
            userId: dto.userId,
            completeName: dto.completeName,
            cpf: dto.cpf,
            birthDate: dto.birthDate,
            sex: dto.sex,
            email: dto.email,
            phone: dto.phone,
            weightKg: dto.weightKg,
            guardianName: dto.guardianName,
            guardianConsent: dto.guardianConsent,
            donatedBefore60: dto.donatedBefore60,
            regularDonor: dto.regularDonor,
            lastDonationDate: dto.lastDonationDate,
            bloodType: dto.bloodType,
            healthDataConsent: dto.healthDataConsent,
            emailVerified: dto.emailVerified,
          },
          this.clock.now(),
        ),
      ),
    );
  }
}
