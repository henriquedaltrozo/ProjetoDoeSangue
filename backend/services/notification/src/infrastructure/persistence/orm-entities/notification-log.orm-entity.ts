import { NotificationJobType } from '@shared/domain/enums';
import { encryptedColumn } from '@shared/infrastructure/persistence';
import { NotificationChannel, NotificationStatus } from '../../../domain/enums';
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Schema `notification`. Registro auditável de cada notificação
 * processada pelo worker - ver docs/01, seção 6 (deixado "em aberto" na
 * modelagem original; implementado aqui junto com o worker).
 */
@Entity({ name: 'sent_notifications', schema: 'notification' })
// Consulta de cada envio (EmailNotifier.wasSent): sem índice, ficaria mais lenta a cada e-mail gravado.
@Index(['jobId', 'recipientIndex'])
export class NotificationLogOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Referência lógica a eligibility.donors.id - nula para notificações
   * que não são sobre um doador (ex: RESET_PASSWORD, que vale para qualquer
   * User, incluindo admin; ver userId abaixo).
   */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  donorId: string | null;

  /** Referência lógica a auth.usuarios.id - preenchida quando a notificação é sobre a conta, não sobre o doador (ex: RESET_PASSWORD). */
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'enum', enum: NotificationJobType })
  type: NotificationJobType;

  @Column({ type: 'enum', enum: NotificationChannel, default: NotificationChannel.EMAIL })
  channel: NotificationChannel;

  /** Cifrado em repouso. A consulta de envio usa `recipientIndex` (índice cego do e-mail). */
  @Column({ type: 'text', transformer: encryptedColumn<string>() })
  recipient: string;

  /** Índice cego (HMAC) do e-mail do destinatário; nulo depois do apagamento dos dados pessoais. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  recipientIndex: string | null;

  @Column({ type: 'text', transformer: encryptedColumn<string>() })
  subject: string;

  /** O texto leva o nome do destinatário: cifrado em repouso. */
  @Column({ type: 'text', transformer: encryptedColumn<string>() })
  message: string;

  @Column({ type: 'enum', enum: NotificationStatus })
  status: NotificationStatus;

  /** O motivo da falha pode trazer o endereço do destinatário: cifrado em repouso. */
  @Column({ type: 'text', nullable: true, transformer: encryptedColumn<string>() })
  error: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  jobId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  sentAt: Date;
}
