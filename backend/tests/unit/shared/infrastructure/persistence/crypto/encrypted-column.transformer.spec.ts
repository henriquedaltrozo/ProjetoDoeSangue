import {
  decryptValue,
  encryptDeterministicLegacy,
  encryptedColumn,
  encryptValue,
  legacyValue,
} from '@src/infrastructure/persistence/crypto/encrypted-column.transformer';

describe('encryptedColumn', () => {
  const ORIGINAL_ENV = process.env.DATA_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.DATA_ENCRYPTION_KEY =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd';
  });

  afterAll(() => {
    process.env.DATA_ENCRYPTION_KEY = ORIGINAL_ENV;
  });

  it('cifra e decifra de volta para o mesmo valor', () => {
    const transformer = encryptedColumn<string>();
    const encrypted = transformer.to!('O+') as string;

    expect(encrypted).not.toBe('O+');
    expect(transformer.from!(encrypted)).toBe('O+');
  });

  it('mantém null/undefined como null (não tenta cifrar valores ausentes)', () => {
    const transformer = encryptedColumn<string>();
    expect(transformer.to!(null)).toBeNull();
    expect(transformer.to!(undefined)).toBeNull();
    expect(transformer.from!(null)).toBeNull();
  });

  it('sem determinismo, duas cifragens do mesmo valor produzem textos diferentes', () => {
    const transformer = encryptedColumn<string>();
    const first = transformer.to!('mesmo valor') as string;
    const second = transformer.to!('mesmo valor') as string;

    expect(first).not.toBe(second);
    expect(transformer.from!(first)).toBe('mesmo valor');
    expect(transformer.from!(second)).toBe('mesmo valor');
  });

  it('determinístico: o mesmo valor sempre produz o mesmo texto cifrado', () => {
    const transformer = encryptedColumn<string>({ deterministic: true });
    const first = transformer.to!('O+') as string;
    const second = transformer.to!('O+') as string;

    expect(first).toBe(second);
  });

  it('determinístico: o IV vem de uma subchave própria, diferente do formato anterior', () => {
    const current = encryptValue('O+', true);
    const legacy = encryptDeterministicLegacy('O+');

    expect(current).not.toBe(legacy);
    // Os dois continuam legíveis (o IV vai junto no texto cifrado).
    expect(decryptValue(current)).toBe('O+');
    expect(decryptValue(legacy)).toBe('O+');
  });

  it('determinístico: valores diferentes produzem textos cifrados diferentes', () => {
    const transformer = encryptedColumn<string>({ deterministic: true });
    expect(transformer.to!('O+')).not.toBe(transformer.to!('A-'));
  });

  it('aplica parse/serialize customizados (ex.: números)', () => {
    const transformer = encryptedColumn<number>({ parse: Number, serialize: String });
    const encrypted = transformer.to!(72.5) as string;
    expect(transformer.from!(encrypted)).toBe(72.5);
  });

  it('lança um erro claro quando DATA_ENCRYPTION_KEY não está configurada', () => {
    delete process.env.DATA_ENCRYPTION_KEY;
    const transformer = encryptedColumn<string>();
    expect(() => transformer.to!('value')).toThrow(/DATA_ENCRYPTION_KEY/);
  });

  it('grava no formato GCM e rejeita valor adulterado', () => {
    const transformer = encryptedColumn<string>();
    const encrypted = transformer.to!('secret') as string;
    expect(encrypted.startsWith('gcm:')).toBe(true);

    const bytes = Buffer.from(encrypted.slice(4), 'base64');
    bytes[bytes.length - 1] ^= 0x01;
    const tampered = `gcm:${bytes.toString('base64')}`;
    expect(() => transformer.from!(tampered)).toThrow();
  });

  it('ainda lê valores antigos gravados em AES-256-CBC', () => {
    const { createCipheriv, createHash, randomBytes } = require('crypto');
    const key = Buffer.from(process.env.DATA_ENCRYPTION_KEY as string, 'utf8');
    const hashed = createHash('sha256').update(key).digest();
    const iv = randomBytes(16);
    const c = createCipheriv('aes-256-cbc', hashed, iv);
    const legacy = Buffer.concat([iv, c.update('O+', 'utf8'), c.final()]).toString('base64');

    const transformer = encryptedColumn<string>();
    expect(transformer.from!(legacy)).toBe('O+');
    expect(legacyValue(legacy)).toBe(true);
  });
});
