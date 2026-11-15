import { NotificationLog } from '../../domain/entities/notification-log';

import type { NotificationStatus } from '../../domain/enums';

export const NOTIFICATION_LOG_REPOSITORY = Symbol('NOTIFICATION_LOG_REPOSITORY');

export interface NotificationLogRepository {
  save(log: NotificationLog): Promise<void>;
  /** Se este job já entregou com sucesso um e-mail a este destinatário (evita reenviar numa nova tentativa). */
  wasSent(jobId: string, recipient: string): Promise<boolean>;
  /**
   * [LGPD] Troca destinatário e texto por um marcador nos registros do titular (pelo usuário ou
   * pelo doador) e guarda que ele pediu a exclusão, para e-mails que ainda estão na fila não saírem.
   * Devolve quantos registros foram alterados.
   */
  erasePersonalData(userId: string, donorId: string | null, marker: string): Promise<number>;
  /** Uma página do registro de envios, mais recentes primeiro, opcionalmente de um status. */
  listPage(
    page: number,
    pageSize: number,
    status?: NotificationStatus,
  ): Promise<{ items: NotificationLog[]; total: number }>;
  /** Apaga os registros de envio anteriores a `before`. Devolve quantos foram apagados. */
  purgeOlderThan(before: Date): Promise<number>;
  /** [LGPD] Se o usuário ou o doador pediu a exclusão da conta (ver erasePersonalData). */
  isErased(donorId: string | null, userId: string | null): Promise<boolean>;
}
