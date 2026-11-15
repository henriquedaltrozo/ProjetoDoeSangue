import { AccessAudit } from '../../../domain/entities/access-audit';
import { AccessAuditOrmEntity } from '../orm-entities/access-audit.orm-entity';

export const AccessAuditMapper = {
  toDomain(orm: AccessAuditOrmEntity): AccessAudit {
    return new AccessAudit({
      id: orm.id,
      donorId: orm.donorId,
      userId: orm.userId ?? null,
      userRole: orm.userRole,
      action: orm.action,
      createdAt: orm.createdAt,
    });
  },
};
