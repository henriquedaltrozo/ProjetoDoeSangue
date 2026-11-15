import { type Actor, requireOwnerOrAdmin } from '@shared/application/auth';
import { CLOCK, type Clock } from '@shared/application/ports';
import { AuditAction } from '../../domain/entities/access-audit';
import type { DonorDeclarationsData, DonorProfileData } from '../../domain/entities/donor';
import { type DonorOutput, toDonorOutput } from '../dto';
import { DONOR_REPOSITORY, type DonorRepository } from '../ports/donor.repository';
import { AuditTrail } from '../services/audit-trail';
import { loadDonorOrFail } from './shared/load-donor';

/**
 * Atualiza os dados do perfil do doador (CPF, nascimento, sexo, telefone, peso, tipo sanguíneo e
 * última doação) e as declarações (responsável legal, doação antes dos 60, doador regular). Nome e
 * e-mail chegam pelo auth-service (UpdateDonorIdentityUseCase). Auditado.
 */
export class UpdateDonorUseCase {
  static readonly inject = [DONOR_REPOSITORY, AuditTrail, CLOCK] as const;

  constructor(
    private readonly donors: DonorRepository,
    private readonly audit: AuditTrail,
    private readonly clock: Clock,
  ) {}

  async execute(
    id: string,
    data: DonorProfileData & DonorDeclarationsData,
    actor: Actor,
  ): Promise<DonorOutput> {
    requireOwnerOrAdmin(actor, id);
    const donor = await loadDonorOrFail(this.donors, id);
    donor.updateProfile(data, this.clock.now());
    donor.updateDeclarations(data);
    const saved = await this.donors.save(donor);
    await this.audit.record(id, actor, AuditAction.UPDATE);
    return toDonorOutput(saved);
  }
}
