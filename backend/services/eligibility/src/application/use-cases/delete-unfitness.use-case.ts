import type { Actor } from '@shared/application/auth';
import { AuditAction } from '../../domain/entities/access-audit';
import { NotFoundError } from '../errors';
import { UNFITNESS_REPOSITORY, type UnfitnessRepository } from '../ports/unfitness.repository';
import { AuditTrail } from '../services/audit-trail';

/**
 * [admin] Exclui uma inaptidão temporária registrada por engano (ex.: motivo ou doador errado).
 * Diferente de encerrar antecipadamente, que mantém o registro: aqui ele deixa de existir. A ação fica
 * no log de auditoria do doador.
 */
export class DeleteUnfitnessUseCase {
  static readonly inject = [UNFITNESS_REPOSITORY, AuditTrail] as const;

  constructor(
    private readonly unfitness: UnfitnessRepository,
    private readonly audit: AuditTrail,
  ) {}

  async execute(donorId: string, unfitnessId: string, actor: Actor): Promise<void> {
    const unfitness = await this.unfitness.findByIdAndDonor(unfitnessId, donorId);
    if (!unfitness) {
      throw new NotFoundError('Período de inaptidão não encontrado.');
    }
    await this.unfitness.remove(unfitness.id);
    await this.audit.record(donorId, actor, AuditAction.UPDATE);
  }
}
