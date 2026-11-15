export const FAILED_JOBS = Symbol('FAILED_JOBS');

/** Um job da fila que esgotou as tentativas (sem os dados pessoais do payload). */
export interface FailedJobSummary {
  id: string;
  /** Tipo do job (ex.: reminder-24h). */
  type: string;
  /** Motivo da última falha. */
  failedReason: string;
  attemptsMade: number;
  failedAt: Date | null;
}

/** Jobs que falharam de vez na fila de e-mails (ficam 7 dias). */
export interface FailedJobs {
  /** Mais recentes primeiro. */
  list(limit: number): Promise<FailedJobSummary[]>;
  /** Devolve o job à fila; false se ele não existe ou não está mais em falha. */
  retry(id: string): Promise<boolean>;
}
