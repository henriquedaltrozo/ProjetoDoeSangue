import { maskEmail } from '../../application/services/email-notifier';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { EmailParams, MailSender } from '../../application/ports/mail-sender.port';

/**
 * Envio real de e-mail via SMTP (Nodemailer) - funciona com qualquer
 * provedor que exponha um endpoint SMTP (SendGrid, SES, Gmail, Mailtrap,
 * ...) sem precisar de SDK específico de vendor, então trocar de provedor é
 * só trocar as variáveis de ambiente (ver .env.example).
 *
 * Quando `SMTP_HOST` não está configurado (padrão em dev/CI, para não
 * exigir credenciais reais para rodar o projeto), cai para o modo simulado
 * que este serviço sempre teve: só loga o que seria enviado.
 */
/** Caixas de teste locais (ou nenhum SMTP): em produção, ninguém recebe os e-mails. */
export function isTestInbox(host: string | undefined): boolean {
  return !host || ['mailpit', 'localhost', '127.0.0.1', 'mailhog'].includes(host.toLowerCase());
}

@Injectable()
export class NodemailerMailSender implements MailSender, OnApplicationBootstrap {
  private readonly logger = new Logger(NodemailerMailSender.name);
  private readonly transporter: Transporter | null;
  private readonly sender: string;
  private readonly host: string | undefined;
  private readonly production: boolean;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    this.host = host;
    this.production = config.get<string>('NODE_ENV') === 'production';
    this.sender = config.get<string>('MAIL_FROM', 'DoeSangue <no-reply@doesangue.local>');

    if (!host) {
      this.transporter = null;
      return;
    }

    const user = config.get<string>('SMTP_USER');
    const password = config.get<string>('SMTP_PASSWORD');
    this.transporter = createTransport({
      host,
      port: config.get<number>('SMTP_PORT', 587),
      // String de propósito (ver env.validation.ts) - evita a ambiguidade
      // de "qualquer string não-vazia é truthy", que faria SMTP_SECURE=false
      // (string) virar `true`.
      secure: config.get<string>('SMTP_SECURE', 'false') === 'true',
      auth: user ? { user: user, pass: password } : undefined,
    });
  }

  /**
   * Ao subir: confere a conexão e as credenciais SMTP, para um problema aparecer no log na hora, e
   * não só no primeiro e-mail que falhar. Em produção, avisa se o envio está simulado ou indo para a
   * caixa de teste local (Mailpit), o que significa que ninguém recebe os e-mails.
   */
  async onApplicationBootstrap(): Promise<void> {
    if (this.production && isTestInbox(this.host)) {
      this.logger.warn(
        this.host
          ? `ATENÇÃO: em produção, mas o SMTP aponta para "${this.host}" (caixa de teste): os e-mails não chegam a ninguém. Configure um provedor real (SMTP_HOST, SMTP_USER, SMTP_PASSWORD).`
          : 'ATENÇÃO: em produção sem SMTP_HOST: o envio de e-mail está só simulado. Configure um provedor real.',
      );
    }
    if (!this.transporter) return;
    try {
      await this.transporter.verify();
      this.logger.log(`Conexão SMTP com ${this.host} conferida.`);
    } catch (err) {
      this.logger.error(
        `Não foi possível conectar ao SMTP ${this.host}: ${(err as Error).message}. Confira SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER e SMTP_PASSWORD; os e-mails vão falhar (com novas tentativas) até isso ser corrigido.`,
      );
    }
  }

  /** Verdadeiro quando um transporte SMTP real está configurado (usado só para logging/diagnóstico). */
  get enabled(): boolean {
    return this.transporter !== null;
  }

  /**
   * Lança em caso de falha de envio - quem chama (EmailNotifier)
   * decide o que fazer com isso (registrar NotificationStatus.FAILURE).
   */
  async send({ to, subject, text, html, headers }: EmailParams): Promise<void> {
    if (!this.transporter) {
      this.logger.log(
        `[SIMULADO] Enviando "${subject}" para ${maskEmail(to)} (SMTP_HOST não configurado)`,
      );
      return;
    }
    await this.transporter.sendMail({
      from: this.sender,
      to,
      subject,
      text,
      html,
      // Idioma do e-mail: ajuda os leitores a não oferecer (ou aplicar) tradução automática.
      headers: { 'Content-Language': 'pt-BR', ...headers },
    });
  }
}
