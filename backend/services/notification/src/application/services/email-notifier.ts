import { LOGGER, LoggerPort } from '@shared/application/ports';
import { NotificationLog } from '../../domain/entities/notification-log';
import { NotificationData } from '../dto/notification-data';
import { MAIL_SENDER, MailSender } from '../ports/mail-sender.port';
import {
  NOTIFICATION_LOG_REPOSITORY,
  NotificationLogRepository,
} from '../ports/notification-log.repository';
import { SUPPRESSION_LIST, type SuppressionList } from '../ports/suppression-list.port';
import { redactTokens } from '../templates/notification-templates';
import { NotificationStatus } from '../../domain/enums';

/** E-mail mascarado para o log (dado pessoal): "maria.souza@x.com" vira "ma***@x.com". */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 2)}***@${domain}`;
}

/** Mascara os e-mails que aparecem num texto (ex.: a mensagem de erro do SMTP), para ir ao log. */
export function maskEmailsIn(text: string): string {
  return text.replace(/[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+/g, (email) => maskEmail(email));
}

/**
 * Serviço de aplicação usado pelo DispatchNotificationUseCase. Envia o e-mail (real via SMTP quando configurado; simulado caso
 * contrário - ver o adapter de MailSender) e sempre grava o registro
 * auditável em NotificationLog (é o que o teste e2e verifica), refletindo o
 * resultado real do envio em `status`/`erro`.
 *
 * Não lança por falha de envio: registra FAILURE no log e devolve `false`; quem decide pedir uma
 * nova tentativa ao BullMQ é o DispatchNotificationUseCase. Numa nova tentativa do mesmo job, quem
 * já recebeu não recebe de novo (ver `wasSent`). Falha ao gravar o log, essa sim, propaga.
 */
export class EmailNotifier {
  static readonly inject = [
    MAIL_SENDER,
    NOTIFICATION_LOG_REPOSITORY,
    LOGGER,
    SUPPRESSION_LIST,
  ] as const;

  constructor(
    private readonly mail: MailSender,
    private readonly logs: NotificationLogRepository,
    private readonly logger: LoggerPort,
    private readonly suppression: SuppressionList,
  ) {}

  /**
   * Envia e grava o log. Devolve `true` se o e-mail foi entregue (agora ou numa tentativa anterior
   * do mesmo job, caso em que não reenvia) e `false` se o envio falhou.
   */
  async send(data: NotificationData): Promise<boolean> {
    // [LGPD] O titular excluiu a conta depois de o e-mail entrar na fila: não envia nem grava.
    if (await this.logs.isErased(data.donorId ?? null, data.userId ?? null)) {
      return true;
    }
    if (data.jobId && (await this.logs.wasSent(data.jobId, data.recipient))) {
      return true;
    }
    // Nenhum token de link (confirmação de presença, redefinição de senha, sair da lista) vai para o
    // registro: quem lê o banco não pode agir em nome do destinatário.
    const log = NotificationLog.byEmail({
      ...data,
      loggedMessage: redactTokens(data.loggedMessage ?? data.message),
    });
    // Endereço que devolveu e-mail ou marcou como spam: não envia (insistir prejudica a reputação
    // do remetente) e não pede nova tentativa. Fica no registro como SUPPRESSED.
    const blocked = await this.suppression.reasonFor(data.recipient);
    if (blocked) {
      log.markSuppressed(blocked);
      await this.logs.save(log);
      return true;
    }
    try {
      await this.mail.send({
        to: data.recipient,
        subject: data.subject,
        text: data.message,
        html: data.html,
        headers: data.headers,
      });
    } catch (err) {
      const reason = (err as Error).message;
      log.markFailure(reason);
      this.logger.error(
        `Falha ao enviar "${data.subject}" para ${maskEmail(data.recipient)}: ${maskEmailsIn(reason)}`,
      );
    }
    await this.logs.save(log);
    return log.status === NotificationStatus.SENT;
  }
}
