import { NotificationJobType } from '@shared/domain/enums';
import {
  ERASE_PERSONAL_DATA_JOB,
  type ErasePersonalDataJobPayload,
  NOTIFICATIONS_QUEUE_NAME,
  type NotificationJobPayload,
} from '@shared/application/messaging';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  JOB_PAYLOAD_OPENER,
  type JobPayloadOpener,
} from '../../application/ports/job-payload-opener.port';
import { DispatchNotificationUseCase } from '../../application/use-cases/dispatch-notification.use-case';
import { ErasePersonalDataUseCase } from '../../application/use-cases/erase-personal-data.use-case';

const KNOWN_TYPES = new Set<string>(Object.values(NotificationJobType));

/**
 * Máximo de jobs por segundo (MAIL_RATE_PER_SECOND, padrão 5): os provedores de e-mail limitam o
 * ritmo de envio, e passar dele faz o provedor recusar (ou marcar como spam). Cada job leva um
 * e-mail, inclusive nas campanhas (um job por doador). Lido direto do ambiente do processo (não do
 * arquivo .env) porque o decorator é avaliado ao carregar a classe: no docker-compose ele já vem no
 * ambiente; rodando fora do Docker, exporte a variável antes de iniciar o serviço.
 */
export function mailRatePerSecond(env: NodeJS.ProcessEnv = process.env): number {
  const value = Number(env.MAIL_RATE_PER_SECOND);
  return Number.isInteger(value) && value >= 1 ? value : 5;
}

/**
 * Worker BullMQ - único consumidor da fila `notifications`. Não expõe
 * HTTP (ver AppModule/main.ts): é assim que o notification-service
 * respeita a arquitetura ("não recebe requisições HTTP do gateway").
 * Só repassa o job ao caso de uso; erros propagam para o BullMQ aplicar
 * retry/backoff. Um job de tipo desconhecido é ignorado (com aviso), sem retry.
 */
/**
 * Quantos jobs o worker processa ao mesmo tempo. Um envio por SMTP leva cerca de 1 s; com um por
 * vez, o ritmo real ficaria perto de 1 e-mail por segundo, abaixo do limite configurado.
 */
export const MAIL_CONCURRENCY = 5;

@Processor(NOTIFICATIONS_QUEUE_NAME, {
  concurrency: MAIL_CONCURRENCY,
  limiter: { max: mailRatePerSecond(), duration: 1000 },
})
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly dispatchNotification: DispatchNotificationUseCase,
    private readonly erasePersonalData: ErasePersonalDataUseCase,
    @Inject(JOB_PAYLOAD_OPENER) private readonly payloads: JobPayloadOpener,
  ) {
    super();
  }

  async process(job: Job<NotificationJobPayload | ErasePersonalDataJobPayload>): Promise<void> {
    if (job.name === ERASE_PERSONAL_DATA_JOB) {
      await this.erasePersonalData.execute(job.data as ErasePersonalDataJobPayload);
      return;
    }
    if (!KNOWN_TYPES.has(job.name)) {
      this.logger.warn(`Job de tipo desconhecido recebido: ${job.name}`);
      return;
    }
    // O corpo vem cifrado (ver os publicadores); jobs enfileirados antes da cifra continuam legíveis.
    await this.dispatchNotification.execute(
      this.payloads.open<NotificationJobPayload>(job.data),
      job.id,
    );
  }

  /**
   * Job que esgotou as tentativas: log de erro com o marcador ALERT, para quem monitora os logs agir
   * (o motivo de cada e-mail fica em `sent_notifications`, com status FAILURE). O job fica 7 dias
   * no Redis (removeOnFail) e pode ser reenfileirado por ali. Sem dados pessoais no log.
   */
  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, err: Error): void {
    if (!job) return;
    const attempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < attempts) return;
    this.logger.error(
      `ALERT: job ${job.id} (${job.name}) falhou definitivamente após ${job.attemptsMade} tentativa(s): ${err.message}`,
    );
  }
}
