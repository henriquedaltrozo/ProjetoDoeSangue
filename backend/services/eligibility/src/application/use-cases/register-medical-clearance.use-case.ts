import type { Actor } from '@shared/application/auth';
import { CLOCK, type Clock } from '@shared/application/ports';
import { AuditAction } from '../../domain/entities/access-audit';
import { type DonorOutput, toDonorOutput } from '../dto';
import { DONOR_REPOSITORY, type DonorRepository } from '../ports/donor.repository';
import { AuditTrail } from '../services/audit-trail';
import { loadDonorOrFail } from './shared/load-donor';

/** [admin] Registra a avaliação médica favorável que libera um doador regular com 70 anos ou mais. Auditado. */
export class RegisterMedicalClearanceUseCase {
  static readonly inject = [DONOR_REPOSITORY, CLOCK, AuditTrail] as const;

  constructor(
    private readonly donors: DonorRepository,
    private readonly clock: Clock,
    private readonly audit: AuditTrail,
  ) {}

  async execute(donorId: string, actor: Actor): Promise<DonorOutput> {
    const donor = await loadDonorOrFail(this.donors, donorId);
    donor.registerMedicalClearance(actor.sub, this.clock.now());
    const saved = await this.donors.save(donor);
    await this.audit.record(donorId, actor, AuditAction.UPDATE);
    return toDonorOutput(saved);
  }
}
