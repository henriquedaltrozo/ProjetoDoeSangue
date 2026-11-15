import { CLOCK, type Clock } from '@shared/application/ports';
import { NotificationJobType } from '@shared/domain/enums';
import { ConflictError, InvalidEntryError } from '../errors/application.errors';
import { ELIGIBILITY_GATEWAY, type EligibilityGateway } from '../ports/eligibility.gateway';
import {
  EMAIL_VERIFICATION_TOKENS,
  type EmailVerificationTokens,
} from '../ports/email-verification-tokens.port';
import { UNIT_OF_WORK, type UnitOfWork } from '../ports/unit-of-work.port';
import { USER_REPOSITORY, type UserRepository } from '../ports/user.repository';

export interface VerifyEmailOutput {
  /** O e-mail confirmado (o login da conta a partir de agora). */
  email: string;
  /** true quando a confirmação concluiu uma troca de e-mail. */
  changed: boolean;
}

const INVALID = 'Link de confirmação inválido. Peça um novo pela página inicial do sistema.';

/**
 * Confirma o e-mail pelo link (sem login: quem abriu o link provou que recebe e-mail no endereço).
 * - Link do e-mail pendente de uma troca: o novo e-mail vira o login (também no doador, no
 *   eligibility-service) e o endereço antigo recebe o aviso "e-mail alterado" (outbox).
 * - Link do e-mail atual: marca como confirmado (e avisa o eligibility, que só manda campanhas e o
 *   "já pode doar" a quem confirmou).
 * Repetir o link já usado não dá erro; um link de um e-mail que já não é o da conta, sim.
 */
export class VerifyEmailUseCase {
  static readonly inject = [
    EMAIL_VERIFICATION_TOKENS,
    USER_REPOSITORY,
    UNIT_OF_WORK,
    ELIGIBILITY_GATEWAY,
    CLOCK,
  ] as const;

  constructor(
    private readonly tokens: EmailVerificationTokens,
    private readonly users: UserRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly eligibility: EligibilityGateway,
    private readonly clock: Clock,
  ) {}

  async execute(token: string): Promise<VerifyEmailOutput> {
    const now = this.clock.now();
    const claims = this.tokens.verify(token, now);
    if (claims === 'expired') {
      throw new InvalidEntryError(
        'Este link de confirmação expirou. Peça um novo pela página inicial do sistema.',
      );
    }
    if (!claims) throw new InvalidEntryError(INVALID);
    const user = await this.users.findById(claims.userId);
    if (!user?.active) throw new InvalidEntryError(INVALID);

    if (user.pendingEmail === claims.email) {
      const owner = await this.users.findByEmail(claims.email);
      if (owner && owner.id !== user.id) {
        throw new ConflictError('Este e-mail já está em uso por outra conta.');
      }
      const oldEmail = user.email;
      const wasVerified = user.emailVerified;
      if (user.donorId) {
        await this.eligibility.updateDonorIdentity(user.donorId, {
          email: claims.email,
          emailVerified: true,
        });
      }
      user.confirmEmailChange(now);
      try {
        await this.unitOfWork.run(async (tx) => {
          await tx.users.save(user);
          // O endereço antigo fica sabendo da troca: se não foi o dono, ele pode agir.
          await tx.accountNotices.add({
            type: NotificationJobType.EMAIL_CHANGED,
            userId: user.id,
            name: user.name,
            recipientEmail: oldEmail,
            newEmail: user.email,
            changedAt: now.toISOString(),
          });
        });
      } catch (err) {
        if (user.donorId) {
          await this.eligibility
            .updateDonorIdentity(user.donorId, { email: oldEmail, emailVerified: wasVerified })
            .catch(() => undefined);
        }
        throw err;
      }
      return { email: user.email, changed: true };
    }

    if (user.email === claims.email) {
      if (!user.emailVerified) {
        if (user.donorId) {
          await this.eligibility.updateDonorIdentity(user.donorId, { emailVerified: true });
        }
        user.markEmailVerified(now);
        await this.users.save(user);
      }
      return { email: user.email, changed: false };
    }

    throw new InvalidEntryError(
      'Este link não vale mais: o e-mail da conta mudou depois que ele foi enviado.',
    );
  }
}
