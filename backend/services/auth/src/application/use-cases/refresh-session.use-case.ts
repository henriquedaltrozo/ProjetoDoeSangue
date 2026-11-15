import { TOKEN_REVOCATION, type TokenRevocation } from '@shared/application/auth';
import { CLOCK, Clock, LOGGER, type LoggerPort } from '@shared/application/ports';
import { AuthResult } from '../dto/user.output';
import { NotAuthenticatedError } from '../errors/application.errors';
import {
  REFRESH_TOKEN_REPOSITORY,
  RefreshTokenRepository,
} from '../ports/refresh-token.repository';
import { TOKEN_GENERATOR, TokenGenerator } from '../ports/token-generator.port';
import { USER_REPOSITORY, UserRepository } from '../ports/user.repository';
import { SessionIssuer } from '../services/session-issuer';

const MESSAGE = 'Refresh token inválido ou expirado.';

/**
 * Tolerância para um token recém-rotacionado: duas abas renovando ao mesmo tempo apresentam o mesmo
 * cookie, e a segunda chega com o token que a primeira acabou de revogar. Isso não é roubo.
 */
export const REUSE_GRACE_MS = 10_000;

/**
 * Rotaciona o refresh token: revoga o apresentado (de forma atômica, então só uma requisição
 * concorrente vence) e emite um novo par. Reapresentar um token revogado há mais tempo que a
 * tolerância indica que ele vazou: todas as sessões do usuário são encerradas (os tokens são
 * apagados, então o mesmo token reapresentado depois não dispara isso de novo).
 */
export class RefreshSessionUseCase {
  static readonly inject = [
    USER_REPOSITORY,
    REFRESH_TOKEN_REPOSITORY,
    TOKEN_GENERATOR,
    CLOCK,
    SessionIssuer,
    LOGGER,
    TOKEN_REVOCATION,
  ] as const;

  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly tokens: TokenGenerator,
    private readonly clock: Clock,
    private readonly sessions: SessionIssuer,
    private readonly logger: LoggerPort,
    private readonly revocation: TokenRevocation,
  ) {}

  async execute(refreshToken: string): Promise<AuthResult> {
    const now = this.clock.now();
    const stored = await this.refreshTokens.findByHash(this.tokens.hash(refreshToken));
    if (!stored) {
      throw new NotAuthenticatedError(MESSAGE);
    }

    if (stored.revokedAt) {
      if (now.getTime() - stored.revokedAt.getTime() > REUSE_GRACE_MS) {
        await this.refreshTokens.deleteUserTokens(stored.userId);
        await this.revocation.revokeUser(stored.userId, now);
        this.logger.warn(
          `Reuso de refresh token revogado (usuário ${stored.userId}): todas as sessões foram encerradas.`,
        );
      }
      throw new NotAuthenticatedError(MESSAGE);
    }

    if (!stored.isValid(now)) {
      throw new NotAuthenticatedError(MESSAGE);
    }

    const user = await this.users.findById(stored.userId);
    if (!user?.active) {
      throw new NotAuthenticatedError(MESSAGE);
    }

    // Só uma requisição concorrente consegue revogar o token; as demais recebem 401.
    if (!(await this.refreshTokens.revokeIfActive(stored.id, now))) {
      throw new NotAuthenticatedError(MESSAGE);
    }

    return this.sessions.issue(user);
  }
}
