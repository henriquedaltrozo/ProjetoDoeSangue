import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Outbox dos avisos de segurança da conta (ver AccountNoticeOutbox). */
@Entity({ name: 'account_notices', schema: 'auth' })
export class AccountNoticeOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Payload do job da fila (tipo, usuário, nome, e-mail, instante da mudança). */
  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  nextAttemptAt: Date;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
