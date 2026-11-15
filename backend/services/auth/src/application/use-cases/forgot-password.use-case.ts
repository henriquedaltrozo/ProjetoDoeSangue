import { CLOCK, Clock, LOGGER, LoggerPort } from '@shared/application/ports';
import {
  PasswordResetToken,
  RESET_TOKEN_EXPIRES_IN_MINUTES,
} from '../../domain/entities/password-reset-token';
import { AUTH_SETTINGS, AuthSettings } from '../ports/auth-settings.port';
import { ID_GENERATOR, IdGenerator } from '../ports/id-generator.port';
import { NOTIFICATION_PUBLISHER, NotificationPublisher } from '../ports/notification.publisher';
import {
  PASSWORD_RESET_TOKEN_REPOSITORY,
  PasswordResetTokenRepository,
} from '../ports/password-reset-token.repository';
import { TOKEN_GENERATOR, TokenGenerator } from '../ports/token-generator.port';
import { USER_REPOSITORY, UserRepository } from '../ports/user.repository';

export interface ForgotPasswordInput {
  email: string;
}

export interface ForgotPasswordOutput {
  message: string;
  resetToken?: string;
}

/**
 * Não revela se o e-mail existe (mensagem sempre genérica) - só gera o
 * token quando a conta existe e está ativa. O e-mail de redefinição é
 * sempre enfileirado (best-effort - ver catch abaixo).
 *
 * Sem SMTP (e-mail só simulado), o link precisa chegar a quem testa por outro caminho:
 * - fora de produção, o token volta na própria resposta da API (a tela mostra o link);
 * - em produção, NUNCA na resposta - senão qualquer pessoa que soubesse um e-mail trocaria a
 *   senha da conta. O link vai só para o log do auth-service, que apenas quem opera o servidor vê.
 */
export class ForgotPasswordUseCase {
  static readonly inject = [
    USER_REPOSITORY,
    PASSWORD_RESET_TOKEN_REPOSITORY,
    TOKEN_GENERATOR,
    NOTIFICATION_PUBLISHER,
    AUTH_SETTINGS,
    CLOCK,
    ID_GENERATOR,
    LOGGER,
  ] as const;

  constructor(
    private readonly users: UserRepository,
    private readonly resetTokens: PasswordResetTokenRepository,
    private readonly tokens: TokenGenerator,
    private readonly notifications: NotificationPublisher,
    private readonly settings: AuthSettings,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly logger: LoggerPort,
  ) {}

  async execute(input: ForgotPasswordInput): Promise<ForgotPasswordOutput> {
    const message = 'Se este e-mail estiver cadastrado, um link de redefinição foi gerado.';
    const user = await this.users.findByEmail(input.email);
    if (!user?.active) {
      return { message };
    }

    // Só o link mais recente vale: os pedidos anteriores ainda não usados deixam de valer.
    await this.resetTokens.invalidateUserPending(user.id, this.clock.now());
    const resetToken = this.tokens.generateResetToken();
    const resetUrl = `${this.settings.frontendUrl}/password-reset?token=${resetToken}`;
    await this.resetTokens.save(
      PasswordResetToken.issue({
        id: this.ids.newId(),
        userId: user.id,
        tokenHash: this.tokens.hash(resetToken),
        now: this.clock.now(),
      }),
    );

    try {
      await this.notifications.enqueueResetPassword({
        userId: user.id,
        recipientEmail: user.email,
        resetUrl,
        expiresInMinutes: RESET_TOKEN_EXPIRES_IN_MINUTES,
      });
    } catch (err) {
      // Best-effort: indisponibilidade do Redis não pode impedir a geração
      // do token (que continua funcionando via resposta da API abaixo,
      // quando SMTP não está configurado).
      this.logger.error(
        `Falha ao enfileirar e-mail de redefinição de senha: ${(err as Error).message}`,
      );
    }

    if (this.settings.smtpConfigured) {
      return { message };
    }
    if (this.settings.production) {
      this.logger.warn(
        `SMTP não configurado: link de redefinição de senha da conta ${user.id}: ${resetUrl}`,
      );
      return { message };
    }
    return { message, resetToken };
  }
}
