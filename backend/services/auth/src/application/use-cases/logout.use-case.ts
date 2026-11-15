import { CLOCK, Clock } from '@shared/application/ports';
import {
  REFRESH_TOKEN_REPOSITORY,
  RefreshTokenRepository,
} from '../ports/refresh-token.repository';
import { TOKEN_GENERATOR, TokenGenerator } from '../ports/token-generator.port';

export class LogoutUseCase {
  static readonly inject = [REFRESH_TOKEN_REPOSITORY, TOKEN_GENERATOR, CLOCK] as const;

  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly tokens: TokenGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(userId: string, refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await this.refreshTokens.revokeByHash(userId, this.tokens.hash(refreshToken), this.clock.now());
  }
}
