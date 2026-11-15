import type { Donor } from '../../../domain/entities/donor';
import { NotFoundError } from '../../errors/application.errors';
import type { DonorRepository } from '../../ports/donor.repository';

/** Carrega o doador ou falha com "não encontrado" (mensagem padrão dos casos de uso). */
export async function loadDonorOrFail(donors: DonorRepository, id: string): Promise<Donor> {
  const donor = await donors.findById(id);
  if (!donor) {
    throw new NotFoundError('Doador não encontrado.');
  }
  return donor;
}
