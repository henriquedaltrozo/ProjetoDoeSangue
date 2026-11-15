import { CLOCK, type Clock } from '@shared/application/ports';
import {
  PASSWORD_RESET_TOKEN_REPOSITORY,
  type PasswordResetTokenRepository,
} from '../ports/password-reset-token.repository';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from '../ports/refresh-token.repository';

export interface PurgeResult {
  refreshTokens: number;
  resetTokens: number;
}

/**
 * Apaga os tokens vencidos (sessões e links de redefinição de senha): depois de vencidos não valem
 * para nada, e sem limpeza as tabelas só cresceriam. Um token de sessão revogado mas ainda dentro da
 * validade fica, porque é ele que denuncia o reuso de um token roubado (ver RefreshSessionUseCase).
 */
export class PurgeExpiredTokensUseCase {
  static readonly inject = [
    REFRESH_TOKEN_REPOSITORY,
    PASSWORD_RESET_TOKEN_REPOSITORY,
    CLOCK,
  ] as const;

  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly resetTokens: PasswordResetTokenRepository,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<PurgeResult> {
    const now = this.clock.now();
    return {
      refreshTokens: await this.refreshTokens.purgeExpired(now),
      resetTokens: await this.resetTokens.purgeExpired(now),
    };
  }
}
