import type { Actor } from '@shared/application/auth';
import { LOGGER, type LoggerPort } from '@shared/application/ports';
import type { AuditAction } from '../../domain/entities/access-audit';
import { AUDIT_REPOSITORY, type AuditRepository } from '../ports/audit.repository';

/** Quem fez a operação auditada: o usuário autenticado ou, na anonimização, o próprio titular. */
export type AuditAuthor = Pick<Actor, 'sub' | 'role'>;

/**
 * [LGPD] Trilha de acesso aos dados pessoais do doador. Cada caso de uso que lê ou altera esses
 * dados chama `record` depois de concluir a operação. Melhor esforço: uma falha ao gravar a
 * auditoria é registrada no log, mas não desfaz nem derruba a operação principal.
 */
export class AuditTrail {
  static readonly inject = [AUDIT_REPOSITORY, LOGGER] as const;

  constructor(
    private readonly accesses: AuditRepository,
    private readonly logger: LoggerPort,
  ) {}

  async record(donorId: string, author: AuditAuthor, action: AuditAction): Promise<void> {
    try {
      await this.accesses.create({ donorId, userId: author.sub, userRole: author.role, action });
    } catch (err) {
      this.logger.error(
        `Falha ao registrar auditoria (donorId=${donorId}, acao=${action}): ${(err as Error).message}`,
        undefined,
        (err as Error).stack,
      );
    }
  }
}
