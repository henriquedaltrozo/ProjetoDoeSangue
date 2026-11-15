import { Role } from '@shared/domain/enums';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Schema `auth`. Credenciais e controle de acesso - dados cadastrais e
 * clínicos do doador vivem em eligibility.donors (ver docs/01).
 */
@Entity({ name: 'users', schema: 'auth' })
export class UserOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'enum', enum: Role })
  role: Role;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  donorId: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  /** Falhas de login consecutivas (zera no sucesso ou ao bloquear). */
  @Column({ type: 'int', default: 0 })
  loginFailures: number;

  /** Enquanto estiver no futuro, o login é recusado (bloqueio temporário por força bruta). */
  @Column({ type: 'timestamptz', nullable: true })
  blockedUntil: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  /** Quando o dono confirmou o e-mail atual (null = ainda não confirmou). */
  @Column({ type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  /** Novo e-mail pedido na troca, à espera de confirmação. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  pendingEmail: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
