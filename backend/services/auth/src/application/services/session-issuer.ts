import { CLOCK, Clock } from '@shared/application/ports';
import { Actor } from '@shared/application/auth';
import { RefreshToken } from '../../domain/entities/refresh-token';
import { User } from '../../domain/entities/user';
import { AuthResult, toUserOutput } from '../dto/user.output';
import { ACCESS_TOKEN_ISSUER, AccessTokenIssuer } from '../ports/access-token-issuer.port';
import { AUTH_SETTINGS, AuthSettings } from '../ports/auth-settings.port';
import { ID_GENERATOR, IdGenerator } from '../ports/id-generator.port';
import {
  REFRESH_TOKEN_REPOSITORY,
  RefreshTokenRepository,
} from '../ports/refresh-token.repository';
import { TOKEN_GENERATOR, TokenGenerator } from '../ports/token-generator.port';

/** Emite o par access token (JWT) + refresh token (persistido só como hash) de um usuário. */
export class SessionIssuer {
  static readonly inject = [
    ACCESS_TOKEN_ISSUER,
    REFRESH_TOKEN_REPOSITORY,
    TOKEN_GENERATOR,
    AUTH_SETTINGS,
    CLOCK,
    ID_GENERATOR,
  ] as const;

  constructor(
    private readonly accessTokens: AccessTokenIssuer,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly tokens: TokenGenerator,
    private readonly settings: AuthSettings,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async issue(user: User): Promise<AuthResult> {
    const payload: Actor = {
      sub: user.id,
      email: user.email,
      role: user.role,
      donorId: user.donorId,
      emailVerified: user.emailVerified,
    };
    const accessToken = await this.accessTokens.issue(payload);
    const refreshToken = this.tokens.generateRefreshToken();

    const stored = RefreshToken.issue({
      id: this.ids.newId(),
      userId: user.id,
      tokenHash: this.tokens.hash(refreshToken),
      now: this.clock.now(),
      validity: this.settings.refreshTokenExpiresAt,
    });
    await this.refreshTokens.save(stored);

    return {
      accessToken,
      refreshToken,
      refreshExpiresAt: stored.expiresAt,
      user: toUserOutput(user),
    };
  }
}
