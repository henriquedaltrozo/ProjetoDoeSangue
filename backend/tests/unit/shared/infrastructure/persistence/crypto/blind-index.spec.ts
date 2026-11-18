import {
  blindIndex,
  cpfIndex,
  emailIndex,
  nameWordIndexes,
  nameWords,
} from '@src/infrastructure/persistence/crypto/blind-index';

describe('índice cego (HMAC)', () => {
  const ORIGINAL_ENV = process.env.DATA_ENCRYPTION_KEY;
  const KEY_A = 'a'.repeat(64);
  const KEY_B = 'b'.repeat(64);

  beforeEach(() => {
    process.env.DATA_ENCRYPTION_KEY = KEY_A;
  });

  afterAll(() => {
    process.env.DATA_ENCRYPTION_KEY = ORIGINAL_ENV;
  });

  it('é determinístico, em hexadecimal de 64 caracteres e não contém o valor', () => {
    const index = cpfIndex('52998224725');
    expect(index).toBe(cpfIndex('52998224725'));
    expect(index).toMatch(/^[0-9a-f]{64}$/);
    expect(index).not.toContain('52998224725');
  });

  it('o CPF vale com ou sem máscara, mas o pseudônimo de um anonimizado não colide com outro', () => {
    expect(cpfIndex('529.982.247-25')).toBe(cpfIndex('52998224725'));
    expect(cpfIndex('52998224725')).not.toBe(cpfIndex('52998224726'));
    expect(cpfIndex('a1b2c3d4e5f')).not.toBe(cpfIndex('123452'));
  });

  it('o e-mail vale sem diferenciar maiúsculas nem espaços nas pontas', () => {
    expect(emailIndex('  Maria@Example.COM ')).toBe(emailIndex('maria@example.com'));
    expect(emailIndex('maria@example.com')).not.toBe(emailIndex('mario@example.com'));
  });

  it('o rótulo de uso separa os campos: o mesmo texto não gera o mesmo índice', () => {
    expect(blindIndex('cpf', 'x')).not.toBe(blindIndex('email', 'x'));
    expect(blindIndex('email', 'silva')).not.toBe(blindIndex('name-word', 'silva'));
  });

  it('depende da chave: sem ela, quem tem só o banco não recalcula o índice', () => {
    const withA = cpfIndex('52998224725');
    process.env.DATA_ENCRYPTION_KEY = KEY_B;
    expect(cpfIndex('52998224725')).not.toBe(withA);
  });

  it('palavras do nome: minúsculas, sem acento e pontuação, sem repetição e sem letra solta', () => {
    expect(nameWords('José da Silva-Sauro, J.')).toEqual(['jose', 'da', 'silva', 'sauro']);
    expect(nameWords('Ana ana ANA')).toEqual(['ana']);
    expect(nameWords('  ')).toEqual([]);
    expect(nameWordIndexes('José Silva')).toEqual(nameWordIndexes('JOSE silva'));
    expect(nameWordIndexes('José Silva')).toHaveLength(2);
  });
});
