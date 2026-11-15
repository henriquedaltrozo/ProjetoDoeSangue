import type { BloodType } from '@shared/domain/enums';
import type { Donor, NewDonor } from '../../domain/entities/donor';

export interface DonorRepository {
  findById(id: string): Promise<Donor | null>;
  findByUserId(userId: string): Promise<Donor | null>;
  findByCpfOrUserId(cpf: string, userId: string): Promise<Donor | null>;
  /**
   * Doadores ativos, com o e-mail confirmado, que aceitam avisos por e-mail (campanhas e "já pode
   * doar"), opcionalmente de um tipo sanguíneo exato.
   */
  listAcceptingAlerts(bloodType?: BloodType): Promise<Donor[]>;
  /**
   * Busca parcial por nome ou CPF entre os doadores ativos, ordenada por nome; sem `search`, lista todos. Devolve a página
   * pedida (`limit` a partir de `offset`) e o total de doadores encontrados.
   */
  find(search: string | undefined, limit: number, offset?: number): Promise<DonorPage>;
  /** Os doadores com estes ids (os inexistentes são ignorados). */
  findByIds(ids: string[]): Promise<Donor[]>;
  create(draft: NewDonor): Promise<Donor>;
  save(donor: Donor): Promise<Donor>;
}

export interface DonorPage {
  items: Donor[];
  total: number;
}

export const DONOR_REPOSITORY = Symbol('DonorRepository');
