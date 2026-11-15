import { UnsubscribeTokenCodec } from '@shared/infrastructure/auth';

describe('UnsubscribeTokenCodec', () => {
  const codec = new UnsubscribeTokenCodec('segredo');

  it('o token gerado devolve o id do doador', () => {
    expect(codec.verify(codec.generate('donor-1'))).toBe('donor-1');
  });

  it('recusa token adulterado, malformado ou assinado com outro segredo', () => {
    const token = codec.generate('donor-1');
    const [body, sig] = token.split('.');
    const otherBody = Buffer.from(JSON.stringify({ d: 'donor-2', v: 1 })).toString('base64url');

    expect(codec.verify(`${otherBody}.${sig}`)).toBeNull();
    expect(codec.verify(`${body}.x`)).toBeNull();
    expect(codec.verify('lixo')).toBeNull();
    expect(new UnsubscribeTokenCodec('outro').verify(token)).toBeNull();
  });
});
