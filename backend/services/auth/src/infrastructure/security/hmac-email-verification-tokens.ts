import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  EmailVerificationClaims,
  EmailVerificationTokens,
} from '../../application/ports/email-verification-tokens.port';

interface Payload {
  u: string;
  e: string;
  /** Validade, em ms desde a época. */
  x: number;
  v: 1;
}

/**
 * Token do link de confirmação de e-mail: HMAC-SHA256 com uma chave derivada do JWT_SECRET e de um
 * rótulo próprio (nunca vale como token de acesso, e vice-versa). Leva o usuário, o e-mail que está
 * sendo confirmado e a validade. Não precisa ser guardado: um link de um e-mail que já não é o da
 * conta (ou o pendente) simplesmente não vale mais.
 */
@Injectable()
export class HmacEmailVerificationTokens implements EmailVerificationTokens {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    this.key = createHmac('sha256', config.getOrThrow<string>('JWT_SECRET'))
      .update('email-verification:v1')
      .digest();
  }

  generate(claims: EmailVerificationClaims, expiresAt: Date): string {
    const payload: Payload = { u: claims.userId, e: claims.email, x: expiresAt.getTime(), v: 1 };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${body}.${this.sign(body)}`;
  }

  verify(token: string, now: Date): EmailVerificationClaims | 'expired' | null {
    const [body, signature, ...rest] = token.split('.');
    if (!body || !signature || rest.length > 0) return null;
    const expected = Buffer.from(this.sign(body));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
    let payload: Payload;
    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8')) as Payload;
    } catch {
      return null;
    }
    if (payload.v !== 1 || typeof payload.u !== 'string' || typeof payload.e !== 'string')
      return null;
    if (typeof payload.x !== 'number' || now.getTime() > payload.x) return 'expired';
    return { userId: payload.u, email: payload.e };
  }

  private sign(body: string): string {
    return createHmac('sha256', this.key).update(body).digest('base64url');
  }
}
