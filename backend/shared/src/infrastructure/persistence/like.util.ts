/** Escapa os curingas do LIKE/ILIKE: `%`, `_` e a barra invertida passam a valer como texto literal. */
export const escapeLike = (value: string): string => value.replace(/[\\%_]/g, '\\$&');
