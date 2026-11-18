import type { BloodType, Sex } from '@shared/domain/enums';
import type { DonorOutput } from '../../../application/dto';

/** Representação HTTP de um doador (contrato da API, independente do domínio e do application). */
export interface DonorResponse {
  id: string;
  userId: string;
  completeName: string;
  cpf: string;
  birthDate: string;
  sex: Sex;
  phone: string | null;
  email: string;
  weightKg: number;
  bloodType: BloodType | null;
  lastDonationAt: string | null;
  donationDates: string[];
  permanentUnfit: boolean;
  /** Motivo registrado pelo hemocentro (null quando não é inapto permanente). */
  permanentUnfitnessReason: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  guardianName: string | null;
  guardianConsentDeclared: boolean;
  donatedBefore60: boolean | null;
  regularDonorDeclared: boolean;
  medicalClearanceAt: string | null;
  medicalClearanceValidUntil: string | null;
  healthDataConsentAt: string | null;
  consentTermVersion: string | null;
  healthDataLegalBasis: string | null;
  personalDataLegalBasis: string | null;
  receiveAlerts: boolean;
}

/** Uma página da busca de doadores do painel admin. */
export interface DonorSearchResponse {
  items: DonorResponse[];
  /** Total encontrado pela busca, em todas as páginas. */
  total: number;
  page: number;
  pageSize: number;
}

export function toDonorResponse(donor: DonorOutput): DonorResponse {
  return {
    id: donor.id,
    userId: donor.userId,
    completeName: donor.completeName,
    cpf: donor.cpf,
    birthDate: donor.birthDate,
    sex: donor.sex,
    phone: donor.phone,
    email: donor.email,
    weightKg: Number(donor.weightKg),
    bloodType: donor.bloodType,
    lastDonationAt: donor.lastDonationAt,
    donationDates: [...donor.donationDates],
    permanentUnfit: donor.permanentUnfit,
    permanentUnfitnessReason: donor.permanentUnfitnessReason,
    active: donor.active,
    createdAt: donor.createdAt.toISOString(),
    updatedAt: donor.updatedAt.toISOString(),
    guardianName: donor.guardianName,
    guardianConsentDeclared: donor.guardianConsentDeclared,
    donatedBefore60: donor.donatedBefore60,
    regularDonorDeclared: donor.regularDonorDeclared,
    medicalClearanceAt: donor.medicalClearanceAt,
    medicalClearanceValidUntil: donor.medicalClearanceValidUntil,
    healthDataConsentAt: donor.healthDataConsentAt?.toISOString() ?? null,
    consentTermVersion: donor.consentTermVersion,
    healthDataLegalBasis: donor.healthDataLegalBasis,
    personalDataLegalBasis: donor.personalDataLegalBasis,
    receiveAlerts: donor.receiveAlerts,
  };
}
