import { BloodType } from '@shared/domain/enums';
import {
  EligibilityAssessmentOutput,
  AssessEligibilityInput,
  DonorContactOutput,
  DonorOutput,
  DonorRecipientOutput,
} from '@shared/application/dto';

export const ELIGIBILITY_GATEWAY = Symbol('ELIGIBILITY_GATEWAY');

/**
 * Acesso ao eligibility-service, sempre com a credencial do próprio serviço (rotas internas): o
 * scheduling já conferiu quem pode agendar e é ele quem conhece o agendamento e o dia da doação; os
 * avisos por e-mail saem do outbox, sem usuário na requisição. Como a credencial chega ao serviço
 * remoto é detalhe do adaptador. Falhas viram DependencyUnavailableError.
 */
export interface EligibilityGateway {
  assessInternal(dto: AssessEligibilityInput): Promise<EligibilityAssessmentOutput>;
  /** Idempotente: `donationDate` (AAAA-MM-DD) permite repetir a chamada sem efeito colateral. */
  completeDonation(donorId: string, donationDate?: string): Promise<DonorOutput>;
  listContactsByBloodType(bloodType?: BloodType): Promise<DonorContactOutput[]>;
  /** Nome e e-mail de um doador, com a credencial do serviço (avisos do outbox); null se não existe. */
  findDonorContact(donorId: string): Promise<DonorRecipientOutput | null>;
}
