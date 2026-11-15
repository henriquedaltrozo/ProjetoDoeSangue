import { Sex } from '../../domain/enums/sex.enum';
import { BloodType } from '../../domain/enums/blood-type.enum';

/**
 * Formato de resposta do eligibility-service para consultas de Donor.
 * É só um contrato de tipagem: quem o produz é o próprio eligibility-service.
 */
export interface DonorOutput {
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
  permanentUnfit: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
