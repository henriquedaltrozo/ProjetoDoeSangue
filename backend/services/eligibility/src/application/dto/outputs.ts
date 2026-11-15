import type {
  BloodType,
  Sex,
  EligibilityResult,
  IneligibilityReason,
  AssessmentSource,
  Role,
  AssessmentNotice,
} from '@shared/domain/enums';
import type { UnfitnessCategory } from '../../domain/enums';
import type { AccessAudit, AuditAction } from '../../domain/entities/access-audit';
import type { EligibilityAssessment } from '../../domain/entities/assessment-eligibility';
import { medicalClearanceValidUntil } from '../../domain/services/age-rules';
import type { Donor } from '../../domain/entities/donor';
import type { TemporaryUnfitness } from '../../domain/entities/temporary-unfitness';

/**
 * Saídas dos casos de uso: dados somente leitura, copiados da entidade por mappers.
 * A presentation só enxerga estes tipos; as entidades de domínio nunca saem do application.
 */
export interface DonorOutput {
  readonly id: string;
  readonly userId: string;
  readonly completeName: string;
  readonly cpf: string;
  readonly birthDate: string;
  readonly sex: Sex;
  readonly phone: string | null;
  readonly email: string;
  readonly weightKg: number;
  readonly bloodType: BloodType | null;
  readonly lastDonationAt: string | null;
  /** Doações dos últimos 12 meses (base do limite anual); também vai na exportação de dados (LGPD). */
  readonly donationDates: readonly string[];
  readonly permanentUnfit: boolean;
  readonly permanentUnfitnessReason: string | null;
  readonly active: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly guardianName: string | null;
  readonly guardianConsentDeclared: boolean;
  readonly donatedBefore60: boolean | null;
  readonly regularDonorDeclared: boolean;
  readonly medicalClearanceAt: string | null;
  /** Último dia em que a avaliação médica vale (null sem avaliação). */
  readonly medicalClearanceValidUntil: string | null;
  /** [LGPD] Quando o doador consentiu com o uso dos dados de saúde (null em cadastros antigos). */
  readonly healthDataConsentAt: Date | null;
  /** Aceita receber avisos de campanhas e de quando pode doar de novo. */
  readonly receiveAlerts: boolean;
}

export interface EligibilityAssessmentOutput {
  readonly id: string;
  readonly donorId: string;
  readonly appointmentId: string | null;
  readonly result: EligibilityResult;
  readonly reasons: IneligibilityReason[];
  readonly notices: AssessmentNotice[];
  readonly nextEligibilityDate: string | null;
  readonly origin: AssessmentSource;
  readonly assessedAt: Date;
}

/**
 * Resultado de uma consulta do doador ("Posso doar hoje?"). Não é gravada (não tem id): só as
 * avaliações dos agendamentos e do pós-doação ficam registradas.
 */
export type EligibilityCheckOutput = Omit<EligibilityAssessmentOutput, 'id' | 'appointmentId'>;

export interface TemporaryUnfitnessOutput {
  readonly id: string;
  readonly donorId: string;
  readonly reason: string;
  readonly category: UnfitnessCategory;
  readonly startDate: string;
  readonly expectedEndDate: string | null;
  readonly actualEndDate: string | null;
  readonly registeredBy: string | null;
  readonly createdAt: Date;
}

export interface AccessAuditOutput {
  readonly id: string;
  readonly donorId: string;
  /** Nulo só em cenários internos (chamada serviço-a-serviço, sem usuário autenticado). */
  readonly userId: string | null;
  readonly userRole: Role;
  readonly action: AuditAction;
  readonly createdAt: Date;
}

export function toDonorOutput(entity: Donor): DonorOutput {
  return {
    id: entity.id,
    userId: entity.userId,
    completeName: entity.completeName,
    cpf: entity.cpf,
    birthDate: entity.birthDate,
    sex: entity.sex,
    phone: entity.phone,
    email: entity.email,
    weightKg: entity.weightKg,
    bloodType: entity.bloodType,
    lastDonationAt: entity.lastDonationAt,
    donationDates: [...entity.donationDates],
    permanentUnfit: entity.permanentUnfit,
    permanentUnfitnessReason: entity.permanentUnfitnessReason,
    active: entity.active,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    guardianName: entity.guardianName,
    guardianConsentDeclared: entity.guardianConsentDeclared,
    donatedBefore60: entity.donatedBefore60,
    regularDonorDeclared: entity.regularDonorDeclared,
    medicalClearanceAt: entity.medicalClearanceAt,
    medicalClearanceValidUntil: entity.medicalClearanceAt
      ? medicalClearanceValidUntil(entity.medicalClearanceAt)
      : null,
    healthDataConsentAt: entity.healthDataConsentAt,
    receiveAlerts: entity.receiveAlerts,
  };
}

export function toEligibilityAssessmentOutput(
  entity: EligibilityAssessment,
): EligibilityAssessmentOutput {
  return {
    id: entity.id,
    donorId: entity.donorId,
    appointmentId: entity.appointmentId,
    result: entity.result,
    reasons: entity.reasons.slice(),
    notices: entity.notices.slice(),
    nextEligibilityDate: entity.nextEligibilityDate,
    origin: entity.origin,
    assessedAt: entity.assessedAt,
  };
}

export function toTemporaryUnfitnessOutput(entity: TemporaryUnfitness): TemporaryUnfitnessOutput {
  return {
    id: entity.id,
    donorId: entity.donorId,
    reason: entity.reason,
    category: entity.category,
    startDate: entity.startDate,
    expectedEndDate: entity.expectedEndDate,
    actualEndDate: entity.actualEndDate,
    registeredBy: entity.registeredBy,
    createdAt: entity.createdAt,
  };
}

export function toAccessAuditOutput(entity: AccessAudit): AccessAuditOutput {
  return {
    id: entity.id,
    donorId: entity.donorId,
    userId: entity.userId,
    userRole: entity.userRole,
    action: entity.action,
    createdAt: entity.createdAt,
  };
}

export interface DonorDataExportOutput {
  readonly donor: DonorOutput;
  readonly temporaryUnfitness: TemporaryUnfitnessOutput[];
  readonly eligibilityAssessments: EligibilityAssessmentOutput[];
}
