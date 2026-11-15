import type { Actor } from '@shared/application/auth';
import { AuditAction } from '../../domain/entities/access-audit';
import { TemporaryUnfitness } from '../../domain/entities/temporary-unfitness';
import {
  type RegisterTemporaryUnfitnessInput,
  type TemporaryUnfitnessOutput,
  toTemporaryUnfitnessOutput,
} from '../dto';
import { DONOR_REPOSITORY, type DonorRepository } from '../ports/donor.repository';
import { UNFITNESS_REPOSITORY, type UnfitnessRepository } from '../ports/unfitness.repository';
import { AuditTrail } from '../services/audit-trail';
import { loadDonorOrFail } from './shared/load-donor';

/** [admin] Registra um período de inaptidão temporária, com quem o registrou (auditado). */
export class RegisterTemporaryUnfitnessUseCase {
  static readonly inject = [DONOR_REPOSITORY, UNFITNESS_REPOSITORY, AuditTrail] as const;

  constructor(
    private readonly donors: DonorRepository,
    private readonly unfitness: UnfitnessRepository,
    private readonly audit: AuditTrail,
  ) {}

  async execute(
    donorId: string,
    input: RegisterTemporaryUnfitnessInput,
    actor: Actor,
  ): Promise<TemporaryUnfitnessOutput> {
    await loadDonorOrFail(this.donors, donorId);
    const created = await this.unfitness.create(
      TemporaryUnfitness.draft({
        donorId,
        reason: input.reason,
        category: input.category,
        startDate: input.startDate,
        expectedEndDate: input.expectedEndDate,
        registeredBy: actor.sub,
      }),
    );
    await this.audit.record(donorId, actor, AuditAction.UPDATE);
    return toTemporaryUnfitnessOutput(created);
  }
}
