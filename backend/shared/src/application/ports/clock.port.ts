export const CLOCK = Symbol('Clock');

/** Fonte do "agora", injetável para testar regras que dependem da data/hora. */
export interface Clock {
  now(): Date;
}
