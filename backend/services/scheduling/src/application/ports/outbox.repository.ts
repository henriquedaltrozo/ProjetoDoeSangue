import { NewOutboxEvent, OutboxEvent } from '../../domain/outbox';

export const OUTBOX_REPOSITORY = Symbol('OUTBOX_REPOSITORY');

/** Appointment COMPLETED que não tem nenhum evento DONATION_COMPLETED no outbox. */
export interface CompletionWithoutEvent {
  appointmentId: string;
  donorId: string;
  completedAt: Date;
  /** Data/hora do agendamento: a doação é registrada no dia dele. */
  appointmentDateTime: Date;
}

export interface OutboxRepository {
  create(draft: NewOutboxEvent): Promise<OutboxEvent>;
  save(event: OutboxEvent): Promise<OutboxEvent>;
  /**
   * Reserva, numa única operação atômica, até `limit` eventos PENDENTES já vencidos (do mais antigo
   * ao mais novo): adia o `nextAttemptAt` deles para `leaseUntil` e os devolve. Instâncias
   * concorrentes não pegam os mesmos eventos (SKIP LOCKED), e nenhuma transação fica aberta durante
   * o processamento. Se quem reservou cair, os eventos vencem em `leaseUntil` e voltam a ser processados.
   */
  claimPending(limit: number, leaseUntil: Date): Promise<OutboxEvent[]>;
  /** Eventos em FAILURE, do mais antigo ao mais novo. */
  listFailures(limit: number): Promise<OutboxEvent[]>;
  findFailureById(id: string): Promise<OutboxEvent | null>;
  /**
   * Devolve para PENDING (tentativas zeradas, reprocessamentos + 1) os eventos
   * em FAILURE cujo período de espera já passou e que ainda não atingiram o
   * limite de reprocessamentos. Retorna quantos foram reativados.
   */
  reactivateFailuresExpired(maxReprocessings: number): Promise<number>;
  /** Eventos em FAILURE que já atingiram o limite de reprocessamentos automáticos. */
  countPermanentFailures(maxReprocessings: number): Promise<number>;
  /** Apaga os eventos já processados antes de `before`. Retorna quantos foram apagados. */
  purgeProcessed(before: Date): Promise<number>;
  /** Criação do evento mais antigo do outbox; nulo se ainda não há eventos. */
  findFirstEventDate(): Promise<Date | null>;
  /** Conclusões a partir de `desde` (limitadas a `windowDays` dias atrás) sem evento no outbox. */
  listCompletionsWithoutEvent(since: Date, windowDays: number): Promise<CompletionWithoutEvent[]>;
}
