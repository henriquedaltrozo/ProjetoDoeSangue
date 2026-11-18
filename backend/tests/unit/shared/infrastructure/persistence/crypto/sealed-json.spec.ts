import {
  isSealed,
  openJson,
  sealedJsonColumn,
  sealJson,
} from '@src/infrastructure/persistence/crypto/sealed-json';

describe('JSON cifrado (sealed)', () => {
  const ORIGINAL_ENV = process.env.DATA_ENCRYPTION_KEY;
  const payload = {
    type: 'RESET_PASSWORD',
    recipientEmail: 'ana@example.com',
    resetUrl: 'http://front/reset?token=segredo',
    nested: { name: 'Ana', list: [1, 2] },
  };

  beforeEach(() => {
    process.env.DATA_ENCRYPTION_KEY = 'c'.repeat(64);
  });

  afterAll(() => {
    process.env.DATA_ENCRYPTION_KEY = ORIGINAL_ENV;
  });

  it('cifra o objeto inteiro e abre de volta igual, sem deixar nada em claro', () => {
    const sealed = sealJson(payload);
    expect(isSealed(sealed)).toBe(true);
    expect(sealed.sealed).toMatch(/^gcm:/);
    expect(JSON.stringify(sealed)).not.toContain('ana@example.com');
    expect(JSON.stringify(sealed)).not.toContain('segredo');
    expect(openJson(sealed)).toEqual(payload);
  });

  it('IV aleatório: cifrar duas vezes o mesmo objeto dá resultados diferentes', () => {
    expect(sealJson(payload).sealed).not.toBe(sealJson(payload).sealed);
  });

  it('um objeto não cifrado (gravado antes da cifra) passa como está', () => {
    expect(openJson(payload)).toBe(payload);
    expect(isSealed(payload)).toBe(false);
    expect(isSealed(null)).toBe(false);
  });

  it('adulterar o conteúdo cifrado faz a leitura falhar (etiqueta de autenticação)', () => {
    const sealed = sealJson(payload);
    const tampered = { sealed: `${sealed.sealed.slice(0, -4)}AAAA` };
    expect(() => openJson(tampered)).toThrow();
  });

  it('coluna jsonb: ida e volta, e nulo continua nulo', () => {
    const column = sealedJsonColumn<typeof payload>();
    const stored = column.to!(payload);
    expect(isSealed(stored)).toBe(true);
    expect(column.from!(stored)).toEqual(payload);
    expect(column.to!(null)).toBeNull();
    expect(column.from!(undefined)).toBeUndefined();
  });
});
