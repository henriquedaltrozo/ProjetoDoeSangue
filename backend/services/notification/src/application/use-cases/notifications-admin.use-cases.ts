import { NotFoundError } from '../errors';
import { FAILED_JOBS, type FailedJobSummary, type FailedJobs } from '../ports/failed-jobs.port';
import {
  NOTIFICATION_LOG_REPOSITORY,
  type NotificationLogRepository,
} from '../ports/notification-log.repository';
import {
  SUPPRESSION_LIST,
  type SuppressedRecipient,
  type SuppressionList,
} from '../ports/suppression-list.port';
import { maskEmail, maskEmailsIn } from '../services/email-notifier';
import type { NotificationStatus } from '../../domain/enums';

export const SENT_PAGE_SIZE = 50;
const FAILED_JOBS_LIMIT = 100;
const SUPPRESSED_LIMIT = 200;

/** Um envio, como o admin vê: destinatário e erro com o e-mail mascarado (dado pessoal). */
export interface SentNotificationOutput {
  id: string;
  type: string;
  recipient: string;
  subject: string;
  status: NotificationStatus;
  error: string | null;
  jobId: string | null;
  sentAt: Date | null;
}

export interface SentNotificationsPage {
  items: SentNotificationOutput[];
  total: number;
  page: number;
  pageSize: number;
}

/** [admin] Registro de envios, mais recentes primeiro, opcionalmente só de um status. */
export class ListSentNotificationsUseCase {
  static readonly inject = [NOTIFICATION_LOG_REPOSITORY] as const;

  constructor(private readonly logs: NotificationLogRepository) {}

  async execute(page: number, status?: NotificationStatus): Promise<SentNotificationsPage> {
    const { items, total } = await this.logs.listPage(page, SENT_PAGE_SIZE, status);
    return {
      items: items.map((log) => ({
        id: log.id ?? '',
        type: log.type,
        recipient: maskEmail(log.recipient),
        subject: log.subject,
        status: log.status,
        error: log.error ? maskEmailsIn(log.error) : null,
        jobId: log.jobId,
        sentAt: log.sentAt,
      })),
      total,
      page,
      pageSize: SENT_PAGE_SIZE,
    };
  }
}

/** [admin] Jobs que esgotaram as tentativas, com o motivo (e-mails mascarados). */
export class ListFailedJobsUseCase {
  static readonly inject = [FAILED_JOBS] as const;

  constructor(private readonly jobs: FailedJobs) {}

  async execute(): Promise<FailedJobSummary[]> {
    const list = await this.jobs.list(FAILED_JOBS_LIMIT);
    return list.map((job) => ({ ...job, failedReason: maskEmailsIn(job.failedReason) }));
  }
}

/**
 * [admin] Devolve à fila um job que falhou de vez (ex.: depois de corrigir o SMTP). Quem já recebeu
 * naquele job não recebe de novo (ver EmailNotifier).
 */
export class RetryFailedJobUseCase {
  static readonly inject = [FAILED_JOBS] as const;

  constructor(private readonly jobs: FailedJobs) {}

  async execute(id: string): Promise<void> {
    if (!(await this.jobs.retry(id))) {
      throw new NotFoundError('Job não encontrado ou não está mais em falha.');
    }
  }
}

/** [admin] Endereços bloqueados (devolveram e-mail ou marcaram como spam). */
export class ListSuppressedUseCase {
  static readonly inject = [SUPPRESSION_LIST] as const;

  constructor(private readonly suppression: SuppressionList) {}

  execute(): Promise<SuppressedRecipient[]> {
    return this.suppression.list(SUPPRESSED_LIMIT);
  }
}

/** [admin] Desbloqueia um endereço (ex.: o doador corrigiu a caixa de entrada). */
export class RemoveSuppressedUseCase {
  static readonly inject = [SUPPRESSION_LIST] as const;

  constructor(private readonly suppression: SuppressionList) {}

  async execute(email: string): Promise<void> {
    if (!(await this.suppression.remove(email))) {
      throw new NotFoundError('Endereço não está bloqueado.');
    }
  }
}
