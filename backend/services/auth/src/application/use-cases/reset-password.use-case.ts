import { TOKEN_REVOCATION, type TokenRevocation } from '@shared/application/auth';
import { CLOCK, Clock } from '@shared/application/ports';
import { NotificationJobType } from '@shared/domain/enums';
import { NotAuthenticatedError } from '../errors/application.errors';
import { PASSWORD_HASHER, PasswordHasher } from '../ports/password-hasher.port';
import { TOKEN_GENERATOR, TokenGenerator } from '../ports/token-generator.port';
import { UNIT_OF_WORK, UnitOfWork } from '../ports/unit-of-work.port';

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

const MESSAGE = 'Token de redefinição inválido ou expirado.';

/**
 * Troca a senha a partir do token de "esqueci a senha". Consumir o token, gravar a senha e encerrar
 * as sessões acontecem numa única transação: o token só vale uma vez (mesmo com duas requisições
 * simultâneas) e nunca fica válido depois de a senha já ter sido trocada.
 */
export class ResetPasswordUseCase {
  static readonly inject = [
    UNIT_OF_WORK,
    PASSWORD_HASHER,
    TOKEN_GENERATOR,
    TOKEN_REVOCATION,
    CLOCK,
  ] as const;

  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenGenerator,
    private readonly revocation: TokenRevocation,
    private readonly clock: Clock,
  ) {}

  async execute(input: ResetPasswordInput): Promise<void> {
    const now = this.clock.now();
    const tokenHash = this.tokens.hash(input.token);
    // O hash da senha (bcrypt, lento) é calculado antes de abrir a transação.
    const passwordHash = await this.hasher.hash(input.newPassword);

    const user = await this.unitOfWork.run(async (tx) => {
      const stored = await tx.resetTokens.findByHash(tokenHash);
      if (!stored?.isValid(now) || !(await tx.resetTokens.consumeIfUnused(stored.id, now))) {
        throw new NotAuthenticatedError(MESSAGE);
      }
      const user = await tx.users.findById(stored.userId);
      if (!user) {
        throw new NotAuthenticatedError(MESSAGE);
      }

      user.changePassword(passwordHash);
      await tx.users.save(user);

      // Por segurança, uma troca de senha encerra todas as sessões (refresh tokens) - evita que
      // quem trocou a senha por suspeita de conta comprometida deixe uma sessão antiga válida.
      await tx.refreshTokens.deleteUserTokens(user.id);
      // Aviso de segurança gravado junto (outbox): a fila fora do ar não faz o aviso se perder.
      await tx.accountNotices.add({
        type: NotificationJobType.PASSWORD_CHANGED,
        userId: user.id,
        name: user.name,
        recipientEmail: user.email,
        changedAt: now.toISOString(),
      });
      return user;
    });
    // E também os tokens de acesso já emitidos (quem trocou a senha pode estar fugindo de um invasor).
    await this.revocation.revokeUser(user.id, now);
  }
}
