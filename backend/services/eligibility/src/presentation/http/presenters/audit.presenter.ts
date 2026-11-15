import type { Role } from '@shared/domain/enums';
import type { AccessAuditOutput } from '../../../application/dto';

/** Representação HTTP de um registro do log de auditoria de acesso. */
export interface AuditResponse {
  id: string;
  donorId: string;
  userId: string | null;
  userRole: Role;
  action: AccessAuditOutput['action'];
  createdAt: string;
}

export function toAuditResponse(a: AccessAuditOutput): AuditResponse {
  return {
    id: a.id,
    donorId: a.donorId,
    userId: a.userId,
    userRole: a.userRole,
    action: a.action,
    createdAt: a.createdAt.toISOString(),
  };
}
