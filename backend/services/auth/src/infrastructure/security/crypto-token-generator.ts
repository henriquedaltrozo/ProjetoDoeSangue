import { createHash, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { TokenGenerator } from '../../application/ports/token-generator.port';

@Injectable()
export class CryptoTokenGenerator implements TokenGenerator {
  generateRefreshToken(): string {
    return randomBytes(48).toString('hex');
  }

  generateResetToken(): string {
    return randomBytes(32).toString('hex');
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
