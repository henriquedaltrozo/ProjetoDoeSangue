import { ValueTransformer } from 'typeorm';
import { decryptValue, encryptValue } from './encrypted-column.transformer';

/**
 * Conteúdo estruturado (JSON) cifrado por inteiro: `{ sealed: "gcm:..." }`. Usado onde o dado
 * pessoal está dentro de um objeto, como o corpo dos jobs da fila e dos avisos da conta, que
 * carregam nome, e-mail e links com token.
 */
export interface Sealed {
  sealed: string;
}

export const isSealed = (value: unknown): value is Sealed =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { sealed?: unknown }).sealed === 'string';

export function sealJson<T>(value: T): Sealed {
  return { sealed: encryptValue(JSON.stringify(value)) };
}

/** Abre o conteúdo cifrado; um objeto não cifrado (gravado antes da cifra) é devolvido como está. */
export function openJson<T>(data: unknown): T {
  return isSealed(data) ? (JSON.parse(decryptValue(data.sealed)) as T) : (data as T);
}

/** Coluna `jsonb` cifrada por inteiro. */
export function sealedJsonColumn<T>(): ValueTransformer {
  return {
    to: (value: T | null | undefined) =>
      value === null || value === undefined ? value : sealJson(value),
    from: (value: unknown) => (value === null || value === undefined ? value : openJson<T>(value)),
  };
}
