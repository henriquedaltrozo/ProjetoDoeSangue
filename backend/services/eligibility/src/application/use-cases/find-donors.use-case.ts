import type { Actor } from '@shared/application/auth';
import { AuditAction } from '../../domain/entities/access-audit';
import { type DonorOutput, toDonorOutput } from '../dto';
import { DONOR_REPOSITORY, type DonorRepository } from '../ports/donor.repository';
import { AuditTrail } from '../services/audit-trail';

/** Limite da lista sem paginação (`execute`): a tela de doadores usa a busca paginada (`searchPage`). */
export const DONORS_SEARCH_LIMIT = 50;

/** Doadores por página na busca do painel admin. */
export const DONORS_PAGE_SIZE = 20;

export interface DonorSearchPage {
  items: DonorOutput[];
  /** Total de doadores encontrados pela busca (em todas as páginas). */
  total: number;
  page: number;
  pageSize: number;
}

/**
 * [admin] Busca doadores por nome ou CPF (parcial), ou pelos ids (ex.: os nomes de uma lista de
 * agendamentos). Cada doador listado entra na trilha de auditoria (ação SEARCH): a lista mostra
 * nome e CPF.
 */
export class FindDonorsUseCase {
  static readonly inject = [DONOR_REPOSITORY, AuditTrail] as const;

  constructor(
    private readonly donors: DonorRepository,
    private readonly audit: AuditTrail,
  ) {}

  async execute(search: string | undefined, actor: Actor, ids?: string[]): Promise<DonorOutput[]> {
    const found = ids
      ? await this.donors.findByIds([...new Set(ids)])
      : (await this.donors.find(search, DONORS_SEARCH_LIMIT)).items;
    await Promise.all(found.map((d) => this.audit.record(d.id, actor, AuditAction.SEARCH)));
    return found.map(toDonorOutput);
  }

  /**
   * Busca paginada por nome ou CPF, ordenada por nome. Só os doadores da página exibida entram na
   * auditoria: os das outras páginas não aparecem na tela.
   */
  async searchPage(search: string, page: number, actor: Actor): Promise<DonorSearchPage> {
    const { items, total } = await this.donors.find(
      search,
      DONORS_PAGE_SIZE,
      (page - 1) * DONORS_PAGE_SIZE,
    );
    await Promise.all(items.map((d) => this.audit.record(d.id, actor, AuditAction.SEARCH)));
    return { items: items.map(toDonorOutput), total, page, pageSize: DONORS_PAGE_SIZE };
  }
}
