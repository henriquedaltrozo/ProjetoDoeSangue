import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { ConfirmationTokenService } from '../../application/ports';
import { InvalidEntryError, ExpiredError } from '../../application/errors';

interface PayloadToken {
  /** id do agendamento. */
  a: string;
  /** expiração, em ms desde a época (o horário do agendamento). */
  e: number;
  /** versão do formato, para poder evoluí-lo sem aceitar tokens antigos. */
  v: 1;
}

/**
 * Token assinado do link de confirmação de presença enviado por e-mail.
 *
 * É propositalmente SEPARADO do JWT de sessão: usa HMAC-SHA256 com uma chave
 * derivada do JWT_SECRET (e de um rótulo próprio), então um token deste tipo
 * nunca é aceito como token de acesso pelo JwtStrategy e vice-versa. Também
 * não carrega papel nem usuário: só prova "quem tem este link pode confirmar
 * presença neste agendamento", e só até o horário dele.
 */
@Injectable()
export class HmacConfirmationTokenService implements ConfirmationTokenService {
  private readonly key: Buffer;
  private readonly frontendUrl: string;

  constructor(config: ConfigService) {
    const secret = config.getOrThrow<string>('JWT_SECRET');
    this.key = createHmac('sha256', secret).update('attendance-confirmation:v1').digest();
    this.frontendUrl = config
      .get<string>('FRONTEND_URL', 'http://localhost:5173')
      .replace(/\/+$/, '');
  }

  generate(appointmentId: string, dateTime: Date): string {
    const payload: PayloadToken = { a: appointmentId, e: dateTime.getTime(), v: 1 };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${body}.${this.sign(body)}`;
  }

  /** Monta o link completo do front que recebe o token. */
  buildUrl(appointmentId: string, dateTime: Date): string {
    return `${this.frontendUrl}/confirm-attendance?token=${this.generate(appointmentId, dateTime)}`;
  }

  /**
   * Devolve o id do agendamento. Lança InvalidEntryError (400) se o token
   * for malformado ou a assinatura não bater, e ExpiredError (410) se for
   * válido mas já expirou.
   */
  verify(token: string): string {
    const [body, signature, ...rest] = token.split('.');
    if (!body || !signature || rest.length > 0 || !this.signatureValid(body, signature)) {
      throw new InvalidEntryError('Link de confirmação inválido.');
    }

    let payload: PayloadToken;
    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8')) as PayloadToken;
    } catch {
      throw new InvalidEntryError('Link de confirmação inválido.');
    }
    if (payload.v !== 1 || typeof payload.a !== 'string' || typeof payload.e !== 'number') {
      throw new InvalidEntryError('Link de confirmação inválido.');
    }
    if (Date.now() > payload.e) {
      throw new ExpiredError('Este link de confirmação expirou.');
    }
    return payload.a;
  }

  private sign(body: string): string {
    return createHmac('sha256', this.key).update(body).digest('base64url');
  }

  private signatureValid(body: string, signature: string): boolean {
    const expected = Buffer.from(this.sign(body));
    const received = Buffer.from(signature);
    return expected.length === received.length && timingSafeEqual(expected, received);
  }
}
