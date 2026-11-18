import { encryptedColumn } from '@shared/infrastructure/persistence';
import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/** Endereços bloqueados: devolveram e-mail ou marcaram como spam (ver SuppressionList). */
@Entity({ name: 'suppressed_recipients', schema: 'notification' })
export class SuppressedRecipientOrmEntity {
  /** Índice cego (HMAC) do e-mail em minúsculas: a consulta e a remoção comparam por ele. */
  @PrimaryColumn({ type: 'varchar', length: 64 })
  emailIndex: string;

  /** Em minúsculas, cifrado em repouso (a lista do painel mostra o endereço). */
  @Column({ type: 'text', transformer: encryptedColumn<string>() })
  email: string;

  @Column({ type: 'varchar', length: 60 })
  reason: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
