import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { OutboxStatus, OutboxEventType } from '../../../domain/outbox';

/** Outbox transacional: gravado na mesma transação da mudança de estado que o originou. */
@Entity({ name: 'outbox_events', schema: 'scheduling' })
@Index(['status', 'nextAttemptAt'])
export class OutboxEventOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 60 })
  type: OutboxEventType;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'varchar', length: 20, default: OutboxStatus.PENDING })
  status: OutboxStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  /** Quantas vezes a reconciliação (ou um admin) devolveu o evento de FAILURE para PENDING. */
  @Column({ type: 'int', default: 0 })
  reprocessings: number;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  /** PENDING: quando tentar de novo. FAILURE: a partir de quando a reconciliação pode reativá-lo. */
  nextAttemptAt: Date;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt: Date | null;
}
