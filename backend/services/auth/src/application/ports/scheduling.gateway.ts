export const SCHEDULING_GATEWAY = Symbol('SchedulingGateway');

/** Acesso ao scheduling-service. Falhas viram DependencyUnavailableError. */
export interface SchedulingGateway {
  /**
   * [LGPD] Cancela os agendamentos em aberto do doador e remove os lembretes da fila (que levam nome
   * e e-mail). Idempotente: parte da exclusão de conta, que pode ser repetida.
   */
  cancelOpenAppointments(donorId: string): Promise<void>;
}
