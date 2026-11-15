import type { Appointment } from '../../../domain/appointment';
import type { Campaign } from '../../../domain/campaign';
import type { CollectionUnit } from '../../../domain/collection-unit';
import { NotFoundError } from '../../errors';
import type {
  AppointmentRepository,
  CampaignRepository,
  CollectionUnitRepository,
} from '../../ports';

/** Carrega o agendamento ou falha com "não encontrado" (mensagem padrão dos casos de uso). */
export async function loadAppointmentOrFail(
  appointments: AppointmentRepository,
  id: string,
): Promise<Appointment> {
  const appointment = await appointments.findById(id);
  if (!appointment) throw new NotFoundError('Agendamento não encontrado.');
  return appointment;
}

/** Carrega a campanha ou falha com "não encontrada". */
export async function loadCampaignOrFail(
  campaigns: CampaignRepository,
  id: string,
): Promise<Campaign> {
  const campaign = await campaigns.findById(id);
  if (!campaign) throw new NotFoundError('Campanha não encontrada.');
  return campaign;
}

/** Carrega a unidade de coleta ou falha com "não encontrada". */
export async function loadCollectionUnitOrFail(
  units: CollectionUnitRepository,
  id: string,
): Promise<CollectionUnit> {
  const unit = await units.findById(id);
  if (!unit) throw new NotFoundError('Unidade de coleta não encontrada.');
  return unit;
}
