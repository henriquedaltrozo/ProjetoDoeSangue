import type { Actor } from '@shared/application/auth';
import { CLOCK, Clock } from '@shared/application/ports';
import { AuditAction } from '../../domain/entities/access-audit';
import { toDateISO } from '../../domain/services/dates';
import {
  type EndTemporaryUnfitnessInput,
  type TemporaryUnfitnessOutput,
  toTemporaryUnfitnessOutput,
} from '../dto';
import { NotFoundError } from '../errors';
import { UNFITNESS_REPOSITORY, type UnfitnessRepository } from '../ports/unfitness.repository';
import { AuditTrail } from '../services/audit-trail';

/**
 * [admin] Encerra antecipadamente um período de inaptidão ainda em aberto (actualEndDate nula) - ex.:
 * o doador se recuperou antes da data prevista. Sem data informada, encerra hoje: o doador já pode
 * doar hoje. Auditado.
 */
export class EndUnfitnessUseCase {
  static readonly inject = [UNFITNESS_REPOSITORY, CLOCK, AuditTrail] as const;

  constructor(
    private readonly unfitness: UnfitnessRepository,
    private readonly clock: Clock,
    private readonly audit: AuditTrail,
  ) {}

  async execute(
    donorId: string,
    unfitnessId: string,
    input: EndTemporaryUnfitnessInput,
    actor: Actor,
  ): Promise<TemporaryUnfitnessOutput> {
    const unfitness = await this.unfitness.findByIdAndDonor(unfitnessId, donorId);
    if (!unfitness) {
      throw new NotFoundError('Período de inaptidão não encontrado.');
    }
    const todayISO = toDateISO(this.clock.now());
    unfitness.end(input.actualEndDate ?? todayISO, todayISO);
    const saved = await this.unfitness.save(unfitness);
    await this.audit.record(donorId, actor, AuditAction.UPDATE);
    return toTemporaryUnfitnessOutput(saved);
  }
}
