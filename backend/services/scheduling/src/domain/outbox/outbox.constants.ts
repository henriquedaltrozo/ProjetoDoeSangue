export const OUTBOX_MAX_ATTEMPTS = 8;
export const OUTBOX_BACKOFF_BASE_MS = 5_000;
export const OUTBOX_BACKOFF_MAX_MS = 15 * 60_000;
export const OUTBOX_BATCH = 10;
/**
 * Por quanto tempo um lote reservado fica fora do alcance de outras instâncias. Cobre com folga o
 * processamento (duas chamadas HTTP de até 5 s por evento); se quem reservou cair, o lote volta depois disso.
 */
export const OUTBOX_LEASE_MS = 2 * 60_000;

/** Depois de esgotar as tentativas, o evento espera isto antes de a reconciliação reativá-lo. */
export const OUTBOX_WAIT_AFTER_FAILURE_MS = 60 * 60_000;
/** Quantas vezes a reconciliação reativa um evento em FAILURE antes de exigir um admin. */
export const OUTBOX_MAX_REPROCESSINGS = 3;
/**
 * Eventos processados há mais que isto são apagados pela reconciliação (o outbox não cresce para
 * sempre). Bem maior que a janela de recuperação: apagar não faz um evento "faltar" e ser recriado.
 */
export const OUTBOX_PROCESSED_RETENTION_DAYS = 90;
/** Janela em que conclusões sem evento no outbox são recuperadas. */
export const OUTBOX_RECONCILIATION_WINDOW_DAYS = 30;
