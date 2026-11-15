import { HmacEmailVerificationTokens } from '@src/infrastructure/security/hmac-email-verification-tokens';

describe('HmacEmailVerificationTokens', () => {
  const config = (secret: string) => ({ getOrThrow: () => secret }) as never;
  const tokens = new HmacEmailVerificationTokens(config('segredo'));
  const now = new Date('2026-11-09T12:00:00.000Z');
  const later = new Date(now.getTime() + 3_600_000);

  it('o token gerado devolve o usuário e o e-mail enquanto vale', () => {
    const token = tokens.generate({ userId: 'u1', email: 'a@x.com' }, later);
    expect(tokens.verify(token, now)).toEqual({ userId: 'u1', email: 'a@x.com' });
  });

  it('depois da validade, "expired"', () => {
    const token = tokens.generate({ userId: 'u1', email: 'a@x.com' }, later);
    expect(tokens.verify(token, new Date(later.getTime() + 1))).toBe('expired');
  });

  it('recusa token adulterado ou assinado com outro segredo', () => {
    const token = tokens.generate({ userId: 'u1', email: 'a@x.com' }, later);
    const [, signature] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ u: 'u2', e: 'b@x.com', x: later.getTime(), v: 1 }),
    ).toString('base64url');
    expect(tokens.verify(`${forged}.${signature}`, now)).toBeNull();
    expect(new HmacEmailVerificationTokens(config('outro')).verify(token, now)).toBeNull();
    expect(tokens.verify('lixo', now)).toBeNull();
  });
});
