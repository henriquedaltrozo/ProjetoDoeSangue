import { CLOCK, type Clock, LOGGER, type LoggerPort } from '@shared/application/ports';
import { ACCOUNT_NOTICE_OUTBOX, type AccountNoticeOutbox } from '../ports/account-notice-outbox';
import {
  NOTIFICATION_PUBLISHER,
  type NotificationPublisher,
} from '../ports/notification.publisher';

const BATCH = 20;
const LEASE_MS = 2 * 60_000;
const BACKOFF_BASE_MS = 5_000;
const BACKOFF_MAX_MS = 15 * 60_000;
/** Depois disso o aviso já não ajuda (o dono soube por outro caminho ou o risco passou): é descartado. */
export const ACCOUNT_NOTICE_MAX_AGE_MS = 24 * 60 * 60_000;

/**
 * Entrega à fila os avisos de segurança gravados no outbox (ver AccountNoticeOutbox). Entregue, o
 * registro é apagado; com falha, tenta de novo com espera crescente (5 s, 10 s... até 15 min). Um
 * aviso com mais de 24 h é descartado com um log ALERT. O jobId fixo por aviso evita e-mail
 * duplicado se a entrega for repetida. Retorna quantos avisos foram tratados.
 */
export class DispatchAccountNoticesUseCase {
  private running = false;

  static readonly inject = [ACCOUNT_NOTICE_OUTBOX, NOTIFICATION_PUBLISHER, CLOCK, LOGGER] as const;

  constructor(
    private readonly outbox: AccountNoticeOutbox,
    private readonly publisher: NotificationPublisher,
    private readonly clock: Clock,
    private readonly logger: LoggerPort,
  ) {}

  async execute(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const now = this.clock.now();
      const notices = await this.outbox.claimDue(BATCH, new Date(now.getTime() + LEASE_MS));
      for (const notice of notices) {
        try {
          await this.publisher.enqueueAccountNotice(notice.payload, `account-notice-${notice.id}`);
          await this.outbox.remove(notice.id);
        } catch (err) {
          await this.registerFailure(notice.id, notice.attempts + 1, notice.createdAt, err, now);
        }
      }
      return notices.length;
    } catch (err) {
      this.logger.error(`Falha ao despachar avisos da conta: ${(err as Error).message}`);
      return 0;
    } finally {
      this.running = false;
    }
  }

  private async registerFailure(
    id: string,
    attempts: number,
    createdAt: Date,
    err: unknown,
    now: Date,
  ): Promise<void> {
    const reason = (err as Error).message;
    if (now.getTime() - createdAt.getTime() > ACCOUNT_NOTICE_MAX_AGE_MS) {
      await this.outbox.remove(id);
      this.logger.error(
        `ALERT: aviso de segurança ${id} descartado após ${attempts} tentativa(s) em 24 h: ${reason}`,
      );
      return;
    }
    const delay = Math.min(BACKOFF_BASE_MS * 2 ** (attempts - 1), BACKOFF_MAX_MS);
    await this.outbox.reschedule(id, attempts, new Date(now.getTime() + delay), reason);
    this.logger.warn(
      `Aviso de segurança ${id} não entrou na fila (tentativa ${attempts}): ${reason}`,
    );
  }
}
