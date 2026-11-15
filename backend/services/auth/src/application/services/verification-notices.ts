import { CLOCK, type Clock } from '@shared/application/ports';
import type { EmailVerificationJobPayload, WelcomeJobPayload } from '@shared/application/messaging';
import { NotificationJobType } from '@shared/domain/enums';
import type { User } from '../../domain/entities/user';
import { AUTH_SETTINGS, type AuthSettings } from '../ports/auth-settings.port';
import {
  EMAIL_VERIFICATION_TOKENS,
  type EmailVerificationTokens,
} from '../ports/email-verification-tokens.port';

/** Validade do link de confirmação de e-mail. */
export const EMAIL_VERIFICATION_HOURS = 48;

/** Monta os e-mails da conta que levam o link de confirmação de e-mail (boas-vindas e confirmação). */
export class VerificationNotices {
  static readonly inject = [EMAIL_VERIFICATION_TOKENS, AUTH_SETTINGS, CLOCK] as const;

  constructor(
    private readonly tokens: EmailVerificationTokens,
    private readonly settings: AuthSettings,
    private readonly clock: Clock,
  ) {}

  /** Link para confirmar `email` como o e-mail desta conta. */
  link(user: User, email: string): string {
    const expiresAt = new Date(this.clock.now().getTime() + EMAIL_VERIFICATION_HOURS * 3_600_000);
    const token = this.tokens.generate({ userId: user.id, email }, expiresAt);
    return `${this.settings.frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;
  }

  /** Boas-vindas ao concluir o cadastro; leva o link de confirmação se o e-mail ainda não foi confirmado. */
  welcome(user: User, donorId: string): WelcomeJobPayload {
    return {
      type: NotificationJobType.WELCOME,
      userId: user.id,
      donorId,
      name: user.name,
      recipientEmail: user.email,
      ...(!user.emailVerified && { verificationUrl: this.link(user, user.email) }),
    };
  }

  /** Link de confirmação: do e-mail atual (reenvio) ou do novo, pedido numa troca. */
  verification(
    user: User,
    email: string,
    purpose: 'signup' | 'change',
  ): EmailVerificationJobPayload {
    return {
      type: NotificationJobType.EMAIL_VERIFICATION,
      userId: user.id,
      name: user.name,
      recipientEmail: email,
      verificationUrl: this.link(user, email),
      purpose,
      expiresInHours: EMAIL_VERIFICATION_HOURS,
    };
  }
}
