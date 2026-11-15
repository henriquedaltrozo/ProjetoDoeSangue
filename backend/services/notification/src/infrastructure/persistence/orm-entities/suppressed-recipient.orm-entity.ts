import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/** Endereços bloqueados: devolveram e-mail ou marcaram como spam (ver SuppressionList). */
@Entity({ name: 'suppressed_recipients', schema: 'notification' })
export class SuppressedRecipientOrmEntity {
  /** Sempre em minúsculas. */
  @PrimaryColumn({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 60 })
  reason: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
