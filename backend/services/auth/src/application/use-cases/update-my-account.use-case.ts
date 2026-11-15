import type { UpdateDonorIdentityInput } from '@shared/application/dto';
import { normalizeEmail } from '../../domain/entities/user';
import { type UserOutput, toUserOutput } from '../dto/user.output';
import {
  ConflictError,
  InvalidEntryError,
  NotAuthenticatedError,
} from '../errors/application.errors';
import { ELIGIBILITY_GATEWAY, EligibilityGateway } from '../ports/eligibility.gateway';
import { UNIT_OF_WORK, type UnitOfWork } from '../ports/unit-of-work.port';
import { PASSWORD_HASHER, PasswordHasher } from '../ports/password-hasher.port';
import { USER_REPOSITORY, UserRepository } from '../ports/user.repository';
import { VerificationNotices } from '../services/verification-notices';

export interface UpdateMyAccountInput {
  name?: string;
  email?: string;
  /** Obrigatória para trocar o e-mail. */
  currentPassword?: string;
}

/**
 * O usuário troca o próprio nome e/ou pede a troca do e-mail de login.
 * - Nome: muda na hora. Num doador, o Donor (eligibility-service) guarda o mesmo nome, então a troca
 *   vai para lá primeiro: se o eligibility recusar ou não responder, nada muda aqui; se a gravação
 *   daqui falhar depois, o Donor volta ao nome anterior.
 * - E-mail: pede a senha atual (uma sessão esquecida aberta não basta para tomar a conta) e fica
 *   pendente: o link de confirmação vai para o endereço novo, e o login só muda quando ele for
 *   confirmado (ver VerifyEmailUseCase, que também avisa o endereço antigo).
 */
export class UpdateMyAccountUseCase {
  static readonly inject = [
    USER_REPOSITORY,
    PASSWORD_HASHER,
    ELIGIBILITY_GATEWAY,
    UNIT_OF_WORK,
    VerificationNotices,
  ] as const;

  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly eligibility: EligibilityGateway,
    private readonly unitOfWork: UnitOfWork,
    private readonly notices: VerificationNotices,
  ) {}

  async execute(userId: string, input: UpdateMyAccountInput): Promise<UserOutput> {
    const user = await this.users.findById(userId);
    if (!user?.active) {
      throw new NotAuthenticatedError();
    }

    const name = input.name?.trim();
    const email = input.email === undefined ? undefined : normalizeEmail(input.email);
    const nameChanged = name !== undefined && name !== user.name;
    const emailChanged = email !== undefined && email !== user.email && email !== user.pendingEmail;
    // Voltar ao e-mail atual com uma troca pendente cancela a troca.
    const cancelPending = email !== undefined && email === user.email && user.pendingEmail !== null;
    if (!nameChanged && !emailChanged && !cancelPending) {
      return toUserOutput(user);
    }

    if (emailChanged) {
      const passwordOk =
        !!input.currentPassword &&
        (await this.hasher.verify(input.currentPassword, user.passwordHash));
      if (!passwordOk) {
        throw new InvalidEntryError('Para trocar o e-mail, informe sua senha atual corretamente.');
      }
      const owner = await this.users.findByEmail(email);
      if (owner && owner.id !== user.id) {
        throw new ConflictError('E-mail já cadastrado.');
      }
    }

    const previousName = user.name;
    if (nameChanged && user.donorId) {
      await this.eligibility.updateDonorIdentity(user.donorId, { completeName: name });
    }

    if (nameChanged) user.updateAccount({ name });
    if (emailChanged || cancelPending) user.requestEmailChange(email as string);
    try {
      // O link de confirmação vai para o endereço novo pelo outbox (não se perde com a fila fora do ar).
      await this.unitOfWork.run(async (tx) => {
        await tx.users.save(user);
        if (emailChanged && user.pendingEmail) {
          await tx.accountNotices.add(this.notices.verification(user, user.pendingEmail, 'change'));
        }
      });
    } catch (err) {
      if (nameChanged && user.donorId) {
        await this.eligibility
          .updateDonorIdentity(user.donorId, {
            completeName: previousName,
          } satisfies UpdateDonorIdentityInput)
          .catch(() => undefined);
      }
      throw err;
    }
    return toUserOutput(user);
  }
}
