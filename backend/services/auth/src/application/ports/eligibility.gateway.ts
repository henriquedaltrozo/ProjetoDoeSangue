import { BloodType, Sex } from '@shared/domain/enums';
import type { DonorDeclarationsInput, UpdateDonorIdentityInput } from '@shared/application/dto';

export const ELIGIBILITY_GATEWAY = Symbol('EligibilityGateway');

/** Doador a criar no eligibility, com as declarações exigidas para a idade. */
export interface NewDonor extends DonorDeclarationsInput {
  userId: string;
  completeName: string;
  cpf: string;
  birthDate: string;
  sex: Sex;
  email: string;
  /** Opcional: DDD + número, só dígitos. Também pode ser informado depois, no perfil. */
  phone?: string;
  weightKg: number;
  bloodType?: BloodType;
  healthDataConsent: boolean;
  /** [LGPD] Versão do termo de consentimento exibida ao doador (ausente = a vigente). */
  consentTermVersion?: string;
  /** O e-mail já foi confirmado (num cadastro novo, false). */
  emailVerified?: boolean;
}

/**
 * Falhas esperadas lançam erros de aplicação: ConflictError (ex.: CPF já
 * cadastrado) ou DependencyUnavailableError.
 */
export interface EligibilityGateway {
  createDonor(donor: NewDonor): Promise<{ id: string }>;
  anonymizeDonor(donorId: string): Promise<void>;
  /** Repassa a troca de nome/e-mail ao Donor (ConflictError/InvalidEntryError se recusada). */
  updateDonorIdentity(donorId: string, data: UpdateDonorIdentityInput): Promise<void>;
  /**
   * Id do doador criado para este usuário, ou `null` se não existe. Permite resolver um cadastro
   * de resultado incerto (a resposta de `createDonor` se perdeu) sem criar nem apagar nada.
   */
  findDonorIdByUser(userId: string): Promise<string | null>;
}
