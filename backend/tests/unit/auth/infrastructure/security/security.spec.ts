import { BcryptPasswordHasher } from '@src/infrastructure/security/bcrypt-password-hasher';
import { CryptoTokenGenerator } from '@src/infrastructure/security/crypto-token-generator';
import { JwtAccessTokenIssuer } from '@src/infrastructure/security/jwt-access-token-issuer';

describe('BcryptPasswordHasher', () => {
  const hasher = new BcryptPasswordHasher();

  it('gera um hash que não é a senha e que a verifica', async () => {
    const hash = await hasher.hash('Segredo#123');
    expect(hash).not.toContain('Segredo');
    await expect(hasher.verify('Segredo#123', hash)).resolves.toBe(true);
    await expect(hasher.verify('outra', hash)).resolves.toBe(false);
  });

  it('com hash nulo (e-mail inexistente) compara com um hash falso e rejeita', async () => {
    await expect(hasher.verify('qualquer', null)).resolves.toBe(false);
  });
});

describe('CryptoTokenGenerator', () => {
  const generator = new CryptoTokenGenerator();

  it('gera tokens hex únicos com o tamanho esperado', () => {
    const refresh = generator.generateRefreshToken();
    const reset = generator.generateResetToken();
    expect(refresh).toMatch(/^[0-9a-f]{96}$/);
    expect(reset).toMatch(/^[0-9a-f]{64}$/);
    expect(generator.generateRefreshToken()).not.toBe(refresh);
  });

  it('hash é determinístico (sha256 em hex) e diferente do token', () => {
    const token = generator.generateResetToken();
    expect(generator.hash(token)).toBe(generator.hash(token));
    expect(generator.hash(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(generator.hash(token)).not.toBe(token);
  });
});

describe('JwtAccessTokenIssuer', () => {
  it('delega a assinatura ao JwtService', async () => {
    const jwt = { signAsync: jest.fn().mockResolvedValue('assinado') };
    const issuer = new JwtAccessTokenIssuer(jwt as never);
    await expect(issuer.issue({ sub: 'u1' } as never)).resolves.toBe('assinado');
    expect(jwt.signAsync).toHaveBeenCalledWith({ sub: 'u1' });
  });
});
