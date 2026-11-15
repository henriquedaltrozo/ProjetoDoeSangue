import { QueryFailedError } from 'typeorm';
import { isUniqueViolation } from '@src/infrastructure/persistence/unique-violation';

describe('isUniqueViolation', () => {
  it('reconhece a violação de UNIQUE do Postgres (23505)', () => {
    expect(isUniqueViolation(new QueryFailedError('INSERT', [], { code: '23505' } as never))).toBe(
      true,
    );
  });

  it('ignora outros erros do banco e erros comuns', () => {
    expect(isUniqueViolation(new QueryFailedError('INSERT', [], { code: '23503' } as never))).toBe(
      false,
    );
    expect(isUniqueViolation(new Error('x'))).toBe(false);
  });
});
