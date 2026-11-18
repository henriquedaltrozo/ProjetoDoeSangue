export const JOB_PAYLOAD_OPENER = Symbol('JOB_PAYLOAD_OPENER');

/**
 * Abre o corpo de um job da fila. Os publicadores o enviam cifrado (nome, e-mail e links com token
 * não ficam em claro no Redis); jobs enfileirados antes da cifra continuam legíveis.
 */
export interface JobPayloadOpener {
  open<T>(data: unknown): T;
}
