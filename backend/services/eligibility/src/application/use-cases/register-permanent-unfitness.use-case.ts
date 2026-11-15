import type { Actor } from '@shared/application/auth';
import { AuditAction } from '../../domain/entities/access-audit';
import { type DonorOutput, toDonorOutput } from '../dto';
import { DONOR_REPOSITORY, type DonorRepository } from '../ports/donor.repository';
import { AuditTrail } from '../services/audit-trail';
import { loadDonorOrFail } from './shared/load-donor';

/** [admin] Registra a inaptidão permanente do doador, com o motivo. Auditado. */
export class RegisterPermanentUnfitnessUseCase {
  static readonly inject = [DONOR_REPOSITORY, AuditTrail] as const;

  constructor(
    private readonly donors: DonorRepository,
    private readonly audit: AuditTrail,
  ) {}

  async execute(donorId: string, reason: string, actor: Actor): Promise<DonorOutput> {
    const donor = await loadDonorOrFail(this.donors, donorId);
    donor.registerPermanentUnfitness(reason);
    const saved = await this.donors.save(donor);
    await this.audit.record(donorId, actor, AuditAction.UPDATE);
    return toDonorOutput(saved);
  }
}
