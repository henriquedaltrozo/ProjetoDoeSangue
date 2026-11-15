import { NotAuthenticatedError } from '../errors/application.errors';
import { UNIT_OF_WORK, type UnitOfWork } from '../ports/unit-of-work.port';
import { USER_REPOSITORY, type UserRepository } from '../ports/user.repository';
import { VerificationNotices } from '../services/verification-notices';

/**
 * Reenvia o link de confirmação: do e-mail novo, se há uma troca pendente; senão, do e-mail atual,
 * se ainda não foi confirmado. Sem nada a confirmar, não envia nada. Vai pelo outbox de avisos da
 * conta (a fila fora do ar não faz o e-mail se perder).
 */
export class ResendEmailVerificationUseCase {
  static readonly inject = [USER_REPOSITORY, UNIT_OF_WORK, VerificationNotices] as const;

  constructor(
    private readonly users: UserRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly notices: VerificationNotices,
  ) {}

  /** Devolve para qual endereço o link foi enviado (null se não havia nada a confirmar). */
  async execute(userId: string): Promise<{ sentTo: string | null }> {
    const user = await this.users.findById(userId);
    if (!user?.active) throw new NotAuthenticatedError();
    const target = user.pendingEmail ?? (user.emailVerified ? null : user.email);
    if (!target) return { sentTo: null };
    const purpose = user.pendingEmail ? 'change' : 'signup';
    await this.unitOfWork.run((tx) =>
      tx.accountNotices.add(this.notices.verification(user, target, purpose)),
    );
    return { sentTo: target };
  }
}
