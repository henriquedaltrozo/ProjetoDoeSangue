import { BloodType } from '../../domain/enums/blood-type.enum';

/**
 * Formato mínimo devolvido pelo eligibility-service (endpoint interno) com
 * os dados de contato necessários para o scheduling-service montar jobs de
 * notificação - nunca inclui dados clínicos sensíveis além do tipo
 * sanguíneo, que é o próprio critério do filtro.
 */
/**
 * Contato de um doador para um aviso individual (ex.: agendamento cancelado). `active` falso indica
 * conta excluída (dados anonimizados): nesse caso não há a quem avisar.
 */
export interface DonorRecipientOutput {
  id: string;
  completeName: string;
  email: string;
  active: boolean;
}

export interface DonorContactOutput {
  id: string;
  completeName: string;
  email: string;
  phone: string | null;
  bloodType: BloodType | null;
}
