import { LOGGER, type LoggerPort } from '@shared/application/ports';
import { SUPPRESSION_LIST, type SuppressionList } from '../ports/suppression-list.port';
import { maskEmail } from '../services/email-notifier';

/** Evento do provedor de e-mail (formato do webhook do Brevo: `event` e `email`). */
export interface MailEvent {
  event: string;
  email: string;
}

/**
 * Eventos que bloqueiam o endereço: insistir num endereço inexistente, recusado ou que marcou spam
 * prejudica a reputação do remetente (e o provedor passa a jogar tudo no spam). Bounces temporários
 * (caixa cheia, servidor fora) não bloqueiam: as novas tentativas resolvem.
 */
export const SUPPRESSING_EVENTS = new Set([
  'hard_bounce',
  'hardbounce',
  'invalid_email',
  'blocked',
  'spam',
  'complaint',
]);

/** Registra os eventos do provedor: bloqueia os endereços dos eventos graves. Devolve quantos bloqueou. */
export class RegisterMailEventsUseCase {
  static readonly inject = [SUPPRESSION_LIST, LOGGER] as const;

  constructor(
    private readonly suppression: SuppressionList,
    private readonly logger: LoggerPort,
  ) {}

  async execute(events: MailEvent[]): Promise<number> {
    let suppressed = 0;
    for (const { event, email } of events) {
      const type = event.trim().toLowerCase();
      if (!SUPPRESSING_EVENTS.has(type) || !email.includes('@')) continue;
      await this.suppression.add(email, type);
      suppressed += 1;
      this.logger.warn(
        `Endereço ${maskEmail(email)} bloqueado (${type}): não recebe mais e-mails.`,
        RegisterMailEventsUseCase.name,
      );
    }
    return suppressed;
  }
}
