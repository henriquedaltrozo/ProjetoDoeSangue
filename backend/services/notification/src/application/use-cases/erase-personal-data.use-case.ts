import type { ErasePersonalDataJobPayload } from '@shared/application/messaging';
import { LOGGER, type LoggerPort } from '@shared/application/ports';
import {
  NOTIFICATION_LOG_REPOSITORY,
  type NotificationLogRepository,
} from '../ports/notification-log.repository';

/** O que fica no lugar do destinatário e do texto dos e-mails do titular. */
export const ERASED_MARKER = '[removido a pedido do titular]';

/**
 * [LGPD] Parte da exclusão de conta: apaga destinatário e texto dos e-mails já enviados ao titular.
 * O registro continua (tipo, data, status), sem identificar a pessoa. Idempotente.
 */
export class ErasePersonalDataUseCase {
  static readonly inject = [NOTIFICATION_LOG_REPOSITORY, LOGGER] as const;

  constructor(
    private readonly logs: NotificationLogRepository,
    private readonly logger: LoggerPort,
  ) {}

  async execute({ userId, donorId }: ErasePersonalDataJobPayload): Promise<void> {
    const erased = await this.logs.erasePersonalData(userId, donorId, ERASED_MARKER);
    this.logger.warn(
      `Dados pessoais removidos de ${erased} registro(s) de envio (usuário ${userId}).`,
      ErasePersonalDataUseCase.name,
    );
  }
}
