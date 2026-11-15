import { AppointmentRepository } from './appointment.repository';
import { CampaignRepository } from './campaign.repository';
import { OutboxRepository } from './outbox.repository';

export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');

/** Repositórios ligados à transação corrente: tudo que passar por eles é confirmado (ou desfeito) junto. */
export interface TransactionalContext {
  appointments: AppointmentRepository;
  campaigns: CampaignRepository;
  outbox: OutboxRepository;
}

export interface UnitOfWork {
  /** Executa o trabalho numa transação; qualquer erro lançado desfaz tudo. */
  run<T>(work: (tx: TransactionalContext) => Promise<T>): Promise<T>;
}
