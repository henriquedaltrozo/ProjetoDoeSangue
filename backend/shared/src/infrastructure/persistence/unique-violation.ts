import { QueryFailedError } from 'typeorm';

/** Código do Postgres para violação de restrição UNIQUE. */
const UNIQUE_VIOLATION = '23505';

/**
 * Se o erro veio de uma restrição UNIQUE. A checagem "já existe?" do caso de uso não basta sob
 * concorrência (duas requisições passam por ela ao mesmo tempo); o banco é quem decide, e o
 * repositório traduz isso num conflito em vez de um erro 500.
 */
export function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof QueryFailedError &&
    (err.driverError as { code?: string } | undefined)?.code === UNIQUE_VIOLATION
  );
}
