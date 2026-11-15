import { CLOCK, Clock } from '@shared/application/ports';
import { TOKEN_REVOCATION, type TokenRevocation } from '@shared/application/auth';
import { AdminAccountNotDeletableError } from '../../domain/errors/domain.errors';
import {
  NotAuthenticatedError,
  AccessDeniedError,
  InvalidEntryError,
} from '../errors/application.errors';
import { ELIGIBILITY_GATEWAY, EligibilityGateway } from '../ports/eligibility.gateway';
import { NOTIFICATION_PUBLISHER, NotificationPublisher } from '../ports/notification.publisher';
import { PASSWORD_HASHER, PasswordHasher } from '../ports/password-hasher.port';
import { SCHEDULING_GATEWAY, SchedulingGateway } from '../ports/scheduling.gateway';
import { TOKEN_GENERATOR, TokenGenerator } from '../ports/token-generator.port';
import { UNIT_OF_WORK, UnitOfWork } from '../ports/unit-of-work.port';
import { USER_REPOSITORY, UserRepository } from '../ports/user.repository';

/**
 * [LGPD - direito ao esquecimento] O próprio doador pede a exclusão dos
 * seus dados. Como não há FK entre schemas (ver docs/01), a operação é
 * orquestrada aqui: primeiro o eligibility-service anonimiza o Donor
 * (nome/CPF/telefone/e-mail), depois este serviço anonimiza o User e
 * revoga qualquer sessão/token pendente. Não é uma exclusão física de
 * linha (soft, via anonimização) para preservar integridade referencial
 * lógica com dados de outros serviços (ex.: agendamentos concluídos
 * seguem existindo, sem dados que identifiquem a pessoa).
 *
 * Atomicidade: os outros serviços têm outros bancos, então a ordem é o que garante o resultado.
 *  1. cancela os agendamentos em aberto no scheduling-service: libera as vagas e tira da fila os
 *     lembretes, que levam nome e e-mail (idempotente);
 *  2. anonimiza o Donor no eligibility-service (idempotente, e os dados pessoais saem primeiro);
 *  3. pede ao notification-service, pela fila, que apague destinatário e texto dos e-mails já
 *     enviados (idempotente: um job por usuário);
 *  4. aqui, numa única transação: anonimiza o User, apaga os refresh tokens e invalida os
 *     tokens de redefinição - ou tudo, ou nada.
 * Se um passo falhar, os seguintes não rodam e o pedido pode ser repetido: os passos já feitos,
 * refeitos, não têm efeito colateral. Nunca sobra um usuário anonimizado só pela metade.
 *
 * Pede a senha atual, como a troca de e-mail: a exclusão não tem volta, e uma sessão esquecida
 * aberta não pode bastar para apagar a conta de alguém.
 *
 * Restrito a contas DONOR: uma conta ADMIN já tem seu próprio ciclo de
 * desativação (ver DeactivateAdminUseCase), que preserva sempre pelo menos
 * um admin ativo - permitir autoexclusão aqui contornaria essa garantia.
 */
export class DeleteMyAccountUseCase {
  static readonly inject = [
    USER_REPOSITORY,
    UNIT_OF_WORK,
    PASSWORD_HASHER,
    TOKEN_GENERATOR,
    ELIGIBILITY_GATEWAY,
    SCHEDULING_GATEWAY,
    NOTIFICATION_PUBLISHER,
    TOKEN_REVOCATION,
    CLOCK,
  ] as const;

  constructor(
    private readonly users: UserRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenGenerator,
    private readonly eligibility: EligibilityGateway,
    private readonly scheduling: SchedulingGateway,
    private readonly notifications: NotificationPublisher,
    private readonly revocation: TokenRevocation,
    private readonly clock: Clock,
  ) {}

  async execute(userId: string, currentPassword: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotAuthenticatedError();
    }
    try {
      user.verifyCanDeleteOwnAccount();
    } catch (err) {
      if (err instanceof AdminAccountNotDeletableError) throw new AccessDeniedError(err.message);
      throw err;
    }
    if (!(await this.hasher.verify(currentPassword, user.passwordHash))) {
      throw new InvalidEntryError(
        'Senha incorreta. Para excluir a conta, informe sua senha atual.',
      );
    }

    if (user.donorId) {
      await this.scheduling.cancelOpenAppointments(user.donorId);
      await this.eligibility.anonymizeDonor(user.donorId);
    }
    await this.notifications.enqueueErasePersonalData(user.id, user.donorId);

    user.anonymize(await this.hasher.hash(this.tokens.generateResetToken()));
    const when = this.clock.now();
    await this.unitOfWork.run(async (tx) => {
      await tx.users.save(user);
      await tx.refreshTokens.deleteUserTokens(user.id);
      await tx.resetTokens.invalidateUserPending(user.id, when);
    });
    await this.revocation.revokeUser(user.id, when);
  }
}
