import { type AccessAuditOutput, toAccessAuditOutput } from '../dto';
import { AUDIT_REPOSITORY, type AuditRepository } from '../ports/audit.repository';

/** Quantos registros o histórico de auditoria de um doador expõe por padrão. */
export const AUDIT_HISTORY_LIMIT = 200;

export class ListAuditUseCase {
  static readonly inject = [AUDIT_REPOSITORY] as const;

  constructor(private readonly accesses: AuditRepository) {}

  async execute(donorId: string): Promise<AccessAuditOutput[]> {
    return (await this.accesses.listByDonor(donorId, AUDIT_HISTORY_LIMIT)).map(toAccessAuditOutput);
  }
}
