import { CLOCK, Clock } from '@shared/application/ports';
import { BloodType, Sex } from '@shared/domain/enums';
import { User } from '../../domain/entities/user';
import { AuthResult } from '../dto/user.output';
import { ConflictError, InvalidEntryError } from '../errors/application.errors';
import { ELIGIBILITY_GATEWAY, EligibilityGateway } from '../ports/eligibility.gateway';
import { ID_GENERATOR, IdGenerator } from '../ports/id-generator.port';
import { PASSWORD_HASHER, PasswordHasher } from '../ports/password-hasher.port';
import { UNIT_OF_WORK, type UnitOfWork } from '../ports/unit-of-work.port';
import { USER_REPOSITORY, UserRepository } from '../ports/user.repository';
import { SessionIssuer } from '../services/session-issuer';
import { VerificationNotices } from '../services/verification-notices';
import type { DonorDeclarationsInput } from '@shared/application/dto';

export interface RegisterDonorInput extends DonorDeclarationsInput {
  email: string;
  password: string;
  name: string;
  cpf: string;
  birthDate: string;
  sex: Sex;
  /** Opcional: DDD + número, só dígitos. Também pode ser informado depois, no perfil. */
  phone?: string;
  weightKg: number;
  bloodType?: BloodType;
  healthDataConsent: boolean;
}

/**
 * Cria o User aqui e o Donor no eligibility-service. Não há transação distribuída, então o
 * cadastro é uma saga com resultado sempre resolvível:
 *
 *  1. grava o User (sem doador vinculado);
 *  2. pede o Donor ao eligibility-service;
 *  3. vincula e devolve a sessão.
 *
 * Se o passo 2 falhar, o que fazer depende do que se sabe do resultado:
 *  - conflito (ex.: CPF já cadastrado): o eligibility rejeitou, nada foi criado lá, então o User
 *    é desfeito;
 *  - qualquer outra falha (timeout, 5xx, resposta perdida): o resultado é incerto, e o Donor pode
 *    existir. Consultamos o eligibility: se o Donor existe, o cadastro é concluído (roll-forward);
 *    se não existe, o User é desfeito. Se nem a consulta responder, o User fica pendente e o
 *    `ReconcileDonorRegistrationsUseCase` resolve depois, do mesmo jeito.
 *
 * Assim nunca sobra Donor sem User nem User pendente para sempre.
 *
 * Repetir o cadastro enquanto o User ainda está pendente não esbarra em "E-mail já cadastrado":
 * se o e-mail pertence a um doador sem Donor vinculado e a senha enviada confere, o cadastro é
 * retomado a partir dele (consulta se o Donor já existe e, só se não existir, o cria).
 */
export class RegisterDonorUseCase {
  static readonly inject = [
    USER_REPOSITORY,
    PASSWORD_HASHER,
    ELIGIBILITY_GATEWAY,
    CLOCK,
    ID_GENERATOR,
    SessionIssuer,
    UNIT_OF_WORK,
    VerificationNotices,
  ] as const;

  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly eligibility: EligibilityGateway,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly sessions: SessionIssuer,
    private readonly unitOfWork: UnitOfWork,
    private readonly notices: VerificationNotices,
  ) {}

  async execute(input: RegisterDonorInput): Promise<AuthResult> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      return this.resume(existing, input);
    }

    const user = User.newDonor({
      id: this.ids.newId(),
      email: input.email,
      passwordHash: await this.hasher.hash(input.password),
      name: input.name,
      createdAt: this.clock.now(),
    });
    await this.users.save(user);

    let donorId: string;
    try {
      donorId = await this.createDonor(user, input);
    } catch (err) {
      donorId = await this.resolveUncertainOutcome(user, err);
    }
    return this.finish(user, donorId);
  }

  /** Retoma o cadastro de um User pendente (mesmo e-mail e senha); qualquer outro caso é conflito. */
  private async resume(user: User, input: RegisterDonorInput): Promise<AuthResult> {
    const resumable =
      user.awaitingDonorLink && (await this.hasher.verify(input.password, user.passwordHash));
    if (!resumable) {
      throw new ConflictError('E-mail já cadastrado.');
    }

    // Se a tentativa anterior chegou a criar o Donor, só falta vincular. Se a consulta falhar,
    // o erro sobe e o User continua pendente (nada é apagado às cegas).
    let donorId = await this.eligibility.findDonorIdByUser(user.id);
    if (!donorId) {
      try {
        donorId = await this.createDonor(user, input);
      } catch (err) {
        donorId = await this.resolveUncertainOutcome(user, err);
      }
    }
    return this.finish(user, donorId);
  }

  private async createDonor(user: User, input: RegisterDonorInput): Promise<string> {
    const donor = await this.eligibility.createDonor({
      userId: user.id,
      completeName: input.name,
      cpf: input.cpf,
      birthDate: input.birthDate,
      sex: input.sex,
      // O mesmo e-mail da conta (já normalizado em minúsculas).
      email: user.email,
      phone: input.phone,
      weightKg: input.weightKg,
      bloodType: input.bloodType,
      healthDataConsent: input.healthDataConsent,
      guardianName: input.guardianName,
      guardianConsent: input.guardianConsent,
      donatedBefore60: input.donatedBefore60,
      regularDonor: input.regularDonor,
      lastDonationDate: input.lastDonationDate,
      // Cadastro novo: o e-mail ainda não foi confirmado (campanhas só depois da confirmação).
      emailVerified: user.emailVerified,
    });
    return donor.id;
  }

  /**
   * Vincula o doador e grava, na mesma transação, o e-mail de boas-vindas (outbox), que leva o link
   * de confirmação do e-mail.
   */
  private async finish(user: User, donorId: string): Promise<AuthResult> {
    user.linkDonor(donorId);
    await this.unitOfWork.run(async (tx) => {
      await tx.users.save(user);
      await tx.accountNotices.add(this.notices.welcome(user, donorId));
    });
    return this.sessions.issue(user);
  }

  /** Devolve o id do Donor (roll-forward) ou desfaz o User e relança o erro original. */
  private async resolveUncertainOutcome(user: User, error: unknown): Promise<string> {
    // Recusa definitiva do eligibility (CPF já cadastrado, dados inválidos para a idade): o doador
    // não foi criado, então o User é desfeito e o erro chega ao cliente como está.
    if (error instanceof ConflictError || error instanceof InvalidEntryError) {
      await this.users.remove(user.id);
      throw error;
    }

    let existing: string | null;
    try {
      existing = await this.eligibility.findDonorIdByUser(user.id);
    } catch {
      // Sem como saber: deixa o User pendente para a reconciliação (nunca apaga às cegas).
      throw error;
    }

    if (existing) {
      return existing;
    }
    await this.users.remove(user.id);
    throw error;
  }
}
