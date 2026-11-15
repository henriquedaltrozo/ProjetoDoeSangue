import type { Actor } from '@shared/application/auth';
import { AuditAction } from '../../domain/entities/access-audit';
import { type DonorOutput, toDonorOutput } from '../dto';
import { DONOR_REPOSITORY, type DonorRepository } from '../ports/donor.repository';
import { AuditTrail } from '../services/audit-trail';
import { loadDonorOrFail } from './shared/load-donor';

/** [admin] Desfaz a avaliação médica (ex.: nova avaliação desfavorável). Auditado. */
export class RevokeMedicalClearanceUseCase {
  static readonly inject = [DONOR_REPOSITORY, AuditTrail] as const;

  constructor(
    private readonly donors: DonorRepository,
    private readonly audit: AuditTrail,
  ) {}

  async execute(donorId: string, actor: Actor): Promise<DonorOutput> {
    const donor = await loadDonorOrFail(this.donors, donorId);
    donor.revokeMedicalClearance();
    const saved = await this.donors.save(donor);
    await this.audit.record(donorId, actor, AuditAction.UPDATE);
    return toDonorOutput(saved);
  }
}
