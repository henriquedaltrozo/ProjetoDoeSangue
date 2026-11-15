import { LOGGER, type LoggerPort } from '@shared/application/ports';
import {
  NOTIFICATION_LOG_REPOSITORY,
  type NotificationLogRepository,
} from '../ports/notification-log.repository';

/**
 * Por quanto tempo o registro de cada envio é guardado. Serve para investigar falhas e saber o que
 * foi enviado; depois disso não tem mais finalidade (e guarda e-mail e texto, dado pessoal - LGPD).
 */
export const NOTIFICATION_LOG_RETENTION_DAYS = 180;

const DAY_MS = 86_400_000;

/** Apaga os registros de envio mais antigos que NOTIFICATION_LOG_RETENTION_DAYS. */
export class PurgeNotificationLogsUseCase {
  static readonly inject = [NOTIFICATION_LOG_REPOSITORY, LOGGER] as const;

  constructor(
    private readonly logs: NotificationLogRepository,
    private readonly logger: LoggerPort,
  ) {}

  async execute(now: Date): Promise<number> {
    const before = new Date(now.getTime() - NOTIFICATION_LOG_RETENTION_DAYS * DAY_MS);
    const purged = await this.logs.purgeOlderThan(before);
    if (purged > 0) {
      this.logger.warn(
        `Limpeza: ${purged} registro(s) de envio com mais de ${NOTIFICATION_LOG_RETENTION_DAYS} dias apagado(s).`,
        PurgeNotificationLogsUseCase.name,
      );
    }
    return purged;
  }
}
