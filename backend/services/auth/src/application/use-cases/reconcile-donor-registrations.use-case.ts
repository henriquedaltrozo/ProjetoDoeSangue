import { CLOCK, Clock, LOGGER, LoggerPort } from '@shared/application/ports';
import { ELIGIBILITY_GATEWAY, EligibilityGateway } from '../ports/eligibility.gateway';
import { UNIT_OF_WORK, type UnitOfWork } from '../ports/unit-of-work.port';
import { USER_REPOSITORY, UserRepository } from '../ports/user.repository';
import { VerificationNotices } from '../services/verification-notices';

/** Tempo mínimo antes de mexer num cadastro pendente (bem acima do timeout da chamada HTTP). */
export const REGISTRATION_GRACE_MS = 2 * 60_000;
const BATCH_SIZE = 50;

export interface ReconciliationResult {
  linked: number;
  removed: number;
  skipped: number;
}

/**
 * Resolve cadastros de doador que ficaram no meio (falha de rede ou queda do processo entre o
 * auth e o eligibility): para cada User sem doador vinculado, pergunta ao eligibility. Se o Donor
 * existe, vincula (conclui o cadastro, com o e-mail de boas-vindas, como no cadastro normal); se não
 * existe, remove o User. Se a consulta falhar, deixa para a próxima rodada: nunca apaga sem ter
 * certeza de que não há Donor.
 */
export class ReconcileDonorRegistrationsUseCase {
  static readonly inject = [
    USER_REPOSITORY,
    ELIGIBILITY_GATEWAY,
    CLOCK,
    LOGGER,
    UNIT_OF_WORK,
    VerificationNotices,
  ] as const;

  constructor(
    private readonly users: UserRepository,
    private readonly eligibility: EligibilityGateway,
    private readonly clock: Clock,
    private readonly logger: LoggerPort,
    private readonly unitOfWork: UnitOfWork,
    private readonly notices: VerificationNotices,
  ) {}

  async execute(): Promise<ReconciliationResult> {
    const limit = new Date(this.clock.now().getTime() - REGISTRATION_GRACE_MS);
    const pending = await this.users.listPendingDonors(limit, BATCH_SIZE);
    const result: ReconciliationResult = { linked: 0, removed: 0, skipped: 0 };

    for (const user of pending) {
      try {
        const donorId = await this.eligibility.findDonorIdByUser(user.id);
        if (donorId) {
          user.linkDonor(donorId);
          await this.unitOfWork.run(async (tx) => {
            await tx.users.save(user);
            await tx.accountNotices.add(this.notices.welcome(user, donorId));
          });
          result.linked += 1;
        } else {
          await this.users.remove(user.id);
          result.removed += 1;
        }
      } catch (err) {
        result.skipped += 1;
        this.logger.warn(
          `Cadastro pendente do usuário ${user.id} não resolvido agora: ${String(err)}`,
          'DonorRegistrationReconciliation',
        );
      }
    }
    return result;
  }
}
