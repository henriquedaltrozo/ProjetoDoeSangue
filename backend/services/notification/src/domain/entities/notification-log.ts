import { NotificationJobType } from '@shared/domain/enums';
import { NotificationChannel, NotificationStatus } from '../enums';

export interface NotificationLogProps {
  id?: string | null;
  donorId: string | null;
  userId: string | null;
  type: NotificationJobType;
  channel: NotificationChannel;
  recipient: string;
  subject: string;
  message: string;
  status: NotificationStatus;
  error: string | null;
  jobId: string | null;
  sentAt?: Date | null;
}

export interface NewEmailNotification {
  /** Omitido para notificações que não são sobre um doador (ex: RESET_PASSWORD) - ver userId. */
  donorId?: string | null;
  /** Omitido para notificações vinculadas a um doador. */
  userId?: string | null;
  type: NotificationJobType;
  recipient: string;
  subject: string;
  message: string;
  /** Texto gravado no log, quando o enviado contém segredos; ausente = `message`. */
  loggedMessage?: string;
  /** Versão HTML enviada junto com o texto (não vai para o log). */
  html?: string;
  /** Cabeçalhos extras do e-mail (não vão para o log). */
  headers?: Record<string, string>;
  jobId?: string | null;
}

/**
 * Registro auditável de uma notificação processada pelo worker. Modelo de
 * domínio puro: a persistência (colunas, enum do Postgres) fica na
 * infraestrutura, via mapper.
 */
export class NotificationLog {
  readonly id: string | null;
  readonly donorId: string | null;
  readonly userId: string | null;
  readonly type: NotificationJobType;
  readonly channel: NotificationChannel;
  readonly recipient: string;
  readonly subject: string;
  readonly message: string;
  readonly jobId: string | null;
  readonly sentAt: Date | null;
  private _status: NotificationStatus;
  private _error: string | null;

  constructor(props: NotificationLogProps) {
    this.id = props.id ?? null;
    this.donorId = props.donorId;
    this.userId = props.userId;
    this.type = props.type;
    this.channel = props.channel;
    this.recipient = props.recipient;
    this.subject = props.subject;
    this.message = props.message;
    this.jobId = props.jobId;
    this.sentAt = props.sentAt ?? null;
    this._status = props.status;
    this._error = props.error;
  }

  /** Nova notificação por e-mail, já assumida como SENT até que se prove o contrário (ver markFailure). */
  static byEmail(data: NewEmailNotification): NotificationLog {
    return new NotificationLog({
      donorId: data.donorId ?? null,
      userId: data.userId ?? null,
      type: data.type,
      channel: NotificationChannel.EMAIL,
      recipient: data.recipient,
      subject: data.subject,
      message: data.loggedMessage ?? data.message,
      status: NotificationStatus.SENT,
      error: null,
      jobId: data.jobId ?? null,
    });
  }

  get status(): NotificationStatus {
    return this._status;
  }

  get error(): string | null {
    return this._error;
  }

  get failed(): boolean {
    return this._status === NotificationStatus.FAILURE;
  }

  /** Registra que o envio falhou, guardando o motivo para investigação. */
  markFailure(reason: string): void {
    this._status = NotificationStatus.FAILURE;
    this._error = reason;
  }

  /** Não enviado porque o endereço está bloqueado (ver SuppressionList). */
  markSuppressed(reason: string): void {
    this._status = NotificationStatus.SUPPRESSED;
    this._error = `Endereço bloqueado: ${reason}`;
  }
}
