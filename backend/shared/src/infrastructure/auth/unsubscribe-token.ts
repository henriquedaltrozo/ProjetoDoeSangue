import { createHmac, timingSafeEqual } from 'node:crypto';

interface Payload {
  /** id do doador. */
  d: string;
  /** versão do formato. */
  v: 1;
}

/**
 * Token assinado do link "não quero mais receber estes avisos" (campanhas e "já pode doar"). O
 * notification-service gera (no e-mail) e o eligibility-service confere (ao desmarcar a
 * preferência). HMAC-SHA256 com uma chave derivada do JWT_SECRET e de um rótulo próprio: nunca vale
 * como token de acesso, e vice-versa. Não expira (um link de descadastro precisa funcionar sempre) e
 * só permite uma coisa: desligar os avisos daquele doador.
 */
export class UnsubscribeTokenCodec {
  private readonly key: Buffer;

  constructor(jwtSecret: string) {
    this.key = createHmac('sha256', jwtSecret).update('alerts-unsubscribe:v1').digest();
  }

  generate(donorId: string): string {
    const body = Buffer.from(JSON.stringify({ d: donorId, v: 1 } satisfies Payload)).toString(
      'base64url',
    );
    return `${body}.${this.sign(body)}`;
  }

  /** Devolve o id do doador, ou null se o token for malformado ou a assinatura não bater. */
  verify(token: string): string | null {
    const [body, signature, ...rest] = token.split('.');
    if (!body || !signature || rest.length > 0) return null;
    const expected = Buffer.from(this.sign(body));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8')) as Payload;
      return payload.v === 1 && typeof payload.d === 'string' ? payload.d : null;
    } catch {
      return null;
    }
  }

  private sign(body: string): string {
    return createHmac('sha256', this.key).update(body).digest('base64url');
  }
}
