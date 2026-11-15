import { UnsubscribeTokenCodec } from '@shared/infrastructure/auth';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UnsubscribeTokens } from '../../application/ports/unsubscribe-tokens.port';

/** Confere o token de descadastro com o mesmo segredo que o notification-service usa para gerá-lo. */
@Injectable()
export class SignedUnsubscribeTokens implements UnsubscribeTokens {
  private readonly codec: UnsubscribeTokenCodec;

  constructor(config: ConfigService) {
    this.codec = new UnsubscribeTokenCodec(config.getOrThrow<string>('JWT_SECRET'));
  }

  verify(token: string): string | null {
    return this.codec.verify(token);
  }
}
