import type { BloodType } from '../../domain/enums/blood-type.enum';
import { Sex } from '../../domain/enums/sex.enum';
import type { DonorDeclarationsInput } from './donor-declarations.input';

/** Entrada do cadastro de doador (enviada pelo auth-service ao eligibility-service). */
export interface CreateDonorInput extends DonorDeclarationsInput {
  userId: string;
  completeName: string;
  cpf: string;
  birthDate: string;
  sex: Sex;
  email: string;
  /** Opcional: DDD + número, só dígitos. Também pode ser informado depois, no perfil. */
  phone?: string;
  weightKg: number;
  /** Opcional: quem souber já informa (serve para os avisos de campanhas por tipo sanguíneo). */
  bloodType?: BloodType;
  /** [LGPD] Consentimento para o uso dos dados de saúde na avaliação de elegibilidade (precisa ser true). */
  healthDataConsent: boolean;
  /** O e-mail já foi confirmado? Num cadastro novo, false (o doador confirma pelo link). Ausente = true. */
  emailVerified?: boolean;
}
