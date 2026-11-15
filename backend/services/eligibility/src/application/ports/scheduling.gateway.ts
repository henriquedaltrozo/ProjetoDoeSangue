export const SCHEDULING_GATEWAY = Symbol('SCHEDULING_GATEWAY');

/** Acesso ao scheduling-service (credencial interna). Falhas propagam: quem chama decide o que fazer. */
export interface SchedulingGateway {
  /** Dos doadores informados, os que já têm um agendamento em aberto. */
  donorsWithOpenAppointment(donorIds: string[]): Promise<string[]>;
}
