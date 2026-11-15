import { type Actor, requireOwnerOrAdmin } from '@shared/application/auth';
import { AuditAction } from '../../domain/entities/access-audit';
import { type TemporaryUnfitnessOutput, toTemporaryUnfitnessOutput } from '../dto';
import { DONOR_REPOSITORY, type DonorRepository } from '../ports/donor.repository';
import { UNFITNESS_REPOSITORY, type UnfitnessRepository } from '../ports/unfitness.repository';
import { AuditTrail } from '../services/audit-trail';
import { loadDonorOrFail } from './shared/load-donor';

/** Histórico de inaptidões do doador, mais recentes primeiro: o próprio doador ou um admin (auditado). */
export class ListUnfitnessUseCase {
  static readonly inject = [DONOR_REPOSITORY, UNFITNESS_REPOSITORY, AuditTrail] as const;

  constructor(
    private readonly donors: DonorRepository,
    private readonly unfitness: UnfitnessRepository,
    private readonly audit: AuditTrail,
  ) {}

  async execute(donorId: string, actor: Actor): Promise<TemporaryUnfitnessOutput[]> {
    requireOwnerOrAdmin(actor, donorId);
    await loadDonorOrFail(this.donors, donorId);
    const list = await this.unfitness.listByDonor(donorId);
    await this.audit.record(donorId, actor, AuditAction.VIEW);
    return list.map(toTemporaryUnfitnessOutput);
  }
}
