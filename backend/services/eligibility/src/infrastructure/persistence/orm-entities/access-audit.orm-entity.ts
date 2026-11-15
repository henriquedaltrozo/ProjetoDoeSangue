import { Role } from '@shared/domain/enums';
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { AuditAction } from '../../../domain/entities/access-audit';

/**
 * Trilha de auditoria de quem acessou/alterou o perfil de qual doador -
 * dado de saúde/pessoal sensível (LGPD), então cada leitura ou escrita
 * relevante feita através do `DonorsController` fica registrada aqui
 * (ver `AuditTrail`). Consultável via `GET /donors/:id/audit`
 * (admin).
 */
@Entity({ name: 'audit_accesses', schema: 'eligibility' })
export class AccessAuditOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  donorId: string;

  /** Nulo só em cenários internos (chamada serviço-a-serviço, sem usuário autenticado). */
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'enum', enum: Role })
  userRole: Role;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
