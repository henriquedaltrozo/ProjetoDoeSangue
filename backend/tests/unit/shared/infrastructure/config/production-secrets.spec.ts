import {
  assertProductionSecrets,
  findInsecureSecrets,
} from '@src/infrastructure/config/production-secrets';

const strong = 'x'.repeat(40);
const hexKey = 'a'.repeat(64);

describe('segredos em produção', () => {
  it('aceita segredos fortes e chave de 32 bytes', () => {
    expect(
      findInsecureSecrets({
        JWT_SECRET: strong,
        INTERNAL_API_KEY: strong,
        DATA_ENCRYPTION_KEY: hexKey,
      }),
    ).toEqual([]);
  });

  it('aponta valor de exemplo, segredo curto e chave em formato errado, sem expor os valores', () => {
    const problems = findInsecureSecrets({
      JWT_SECRET: 'troque-este-segredo-em-producao',
      INTERNAL_API_KEY: 'curta',
      DATA_ENCRYPTION_KEY: 'uma frase qualquer',
    });
    expect(problems).toHaveLength(3);
    expect(problems.join(' ')).not.toContain('troque-este-segredo');
  });

  it('recusa subir em produção com segredos inseguros', () => {
    expect(() =>
      assertProductionSecrets({ NODE_ENV: 'production', JWT_SECRET: 'troque-isto' }),
    ).toThrow(/Segredos inseguros/);
  });

  it('com a liberação explícita, sobe mas avisa', () => {
    const warn = jest.fn();
    expect(() =>
      assertProductionSecrets(
        {
          NODE_ENV: 'production',
          JWT_SECRET: 'troque-isto',
          ALLOW_INSECURE_DEFAULT_SECRETS: 'true',
        },
        warn,
      ),
    ).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('JWT_SECRET'));
  });

  it('fora de produção não verifica nada', () => {
    expect(() =>
      assertProductionSecrets({ NODE_ENV: 'development', JWT_SECRET: 'troque-isto' }),
    ).not.toThrow();
  });
});
