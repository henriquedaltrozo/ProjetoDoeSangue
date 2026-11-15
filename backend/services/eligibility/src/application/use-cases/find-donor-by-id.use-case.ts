import { type Actor, requireOwnerOrAdmin } from '@shared/application/auth';
import { AuditAction } from '../../domain/entities/access-audit';
import { type DonorOutput, toDonorOutput } from '../dto';
import { DONOR_REPOSITORY, type DonorRepository } from '../ports/donor.repository';
import { AuditTrail } from '../services/audit-trail';
import { loadDonorOrFail } from './shared/load-donor';

/** Perfil completo do doador: o próprio doador ou um admin; toda leitura é auditada. */
export class FindDonorByIdUseCase {
  static readonly inject = [DONOR_REPOSITORY, AuditTrail] as const;

  constructor(
    private readonly donors: DonorRepository,
    private readonly audit: AuditTrail,
  ) {}

  async execute(id: string, actor: Actor): Promise<DonorOutput> {
    requireOwnerOrAdmin(actor, id);
    const donor = await loadDonorOrFail(this.donors, id);
    await this.audit.record(id, actor, AuditAction.VIEW);
    return toDonorOutput(donor);
  }
}
