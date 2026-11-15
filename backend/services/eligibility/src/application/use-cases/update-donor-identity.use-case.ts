import type { UpdateDonorIdentityInput } from '@shared/application/dto';
import { Role } from '@shared/domain/enums';
import { AuditAction } from '../../domain/entities/access-audit';
import { type DonorOutput, toDonorOutput } from '../dto';
import { DONOR_REPOSITORY, type DonorRepository } from '../ports/donor.repository';
import { AuditTrail } from '../services/audit-trail';
import { loadDonorOrFail } from './shared/load-donor';

/**
 * [interno] Nome e e-mail do doador. Quem troca é o próprio usuário, na conta (auth-service, dono do
 * login), que repassa a troca para cá; a auditoria fica em nome do titular.
 */
export class UpdateDonorIdentityUseCase {
  static readonly inject = [DONOR_REPOSITORY, AuditTrail] as const;

  constructor(
    private readonly donors: DonorRepository,
    private readonly audit: AuditTrail,
  ) {}

  async execute(id: string, data: UpdateDonorIdentityInput): Promise<DonorOutput> {
    const donor = await loadDonorOrFail(this.donors, id);
    donor.updateIdentity(data);
    const saved = await this.donors.save(donor);
    await this.audit.record(id, { sub: donor.userId, role: Role.DONOR }, AuditAction.UPDATE);
    return toDonorOutput(saved);
  }
}
