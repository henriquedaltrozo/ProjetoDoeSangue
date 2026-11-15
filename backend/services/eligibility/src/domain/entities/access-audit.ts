import { Role } from '@shared/domain/enums';

/** Ações registradas no log de auditoria de acesso a dados de doador. */
export enum AuditAction {
  VIEW = 'VIEW',
  UPDATE = 'UPDATE',
  EXPORT = 'EXPORT',
  ANONYMIZATION = 'ANONYMIZATION',
  /** O doador apareceu numa busca do admin (nome e CPF exibidos na lista). */
  SEARCH = 'SEARCH',
}

export interface AccessAuditProps {
  id: string;
  donorId: string;
  /** Nulo só em cenários internos (chamada serviço-a-serviço, sem usuário autenticado). */
  userId: string | null;
  userRole: Role;
  action: AuditAction;
  createdAt: Date;
}

export type NewAccessAudit = Omit<AccessAuditProps, 'id' | 'createdAt'>;

/**
 * Trilha de auditoria de quem acessou/alterou o perfil de qual doador - dado de saúde/pessoal
 * sensível (LGPD).
 */
export class AccessAudit {
  readonly id: string;
  readonly donorId: string;
  readonly userId: string | null;
  readonly userRole: Role;
  readonly action: AuditAction;
  readonly createdAt: Date;

  constructor(props: AccessAuditProps) {
    this.id = props.id;
    this.donorId = props.donorId;
    this.userId = props.userId;
    this.userRole = props.userRole;
    this.action = props.action;
    this.createdAt = props.createdAt;
  }
}
