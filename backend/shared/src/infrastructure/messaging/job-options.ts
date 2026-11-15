import type { JobsOptions } from 'bullmq';

/**
 * Opções padrão dos jobs da fila `notifications`: tentativas automáticas com backoff exponencial.
 * O notification-service relança quando algum e-mail do job falha, e numa nova tentativa só reenvia
 * a quem ainda não recebeu (ver EmailNotifier) - por isso repetir não gera e-mail duplicado.
 *
 * 10 tentativas a partir de 30 s (30 s, 1 min, 2 min... até 2 h8 entre a 9ª e a 10ª): cobrem cerca de
 * 4 horas, o bastante para atravessar uma queda do provedor de e-mail sem perder os envios.
 */
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 10,
  backoff: { type: 'exponential', delay: 30_000 },
  removeOnComplete: true,
  // Um job que falhou guarda nome e e-mail no Redis: fica para investigação, mas no máximo 7 dias.
  removeOnFail: { count: 100, age: 7 * 24 * 3600 },
};
