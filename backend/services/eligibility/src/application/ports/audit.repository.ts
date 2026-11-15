import type { AccessAudit, NewAccessAudit } from '../../domain/entities/access-audit';

export interface AuditRepository {
  create(draft: NewAccessAudit): Promise<AccessAudit>;
  /** Mais recentes primeiro (por createdAt), até `limite` registros. */
  listByDonor(donorId: string, limit: number): Promise<AccessAudit[]>;
}

export const AUDIT_REPOSITORY = Symbol('AuditRepository');
