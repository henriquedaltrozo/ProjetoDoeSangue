import { Role } from '@shared/domain/enums';
import { AuditAction } from '../../domain/entities/access-audit';
import { TEXT_ANONYMIZED } from '../../domain/entities/donor';
import { DONOR_REPOSITORY, type DonorRepository } from '../ports/donor.repository';
import { UNFITNESS_REPOSITORY, type UnfitnessRepository } from '../ports/unfitness.repository';
import { AuditTrail } from '../services/audit-trail';
import { loadDonorOrFail } from './shared/load-donor';

/**
 * [LGPD - direito ao esquecimento, interno] Anonimiza os dados identificantes do doador em vez de
 * apagar o registro: preserva dados clínicos/estatísticos não identificantes e descaracteriza
 * nome, CPF, telefone, e-mail e motivos em texto livre. Orquestrado pelo auth-service em
 * `POST /auth/me/delete-data`; a auditoria fica em nome do próprio titular, que é quem a pede.
 */
export class AnonymizeDataUseCase {
  static readonly inject = [DONOR_REPOSITORY, UNFITNESS_REPOSITORY, AuditTrail] as const;

  constructor(
    private readonly donors: DonorRepository,
    private readonly unfitness: UnfitnessRepository,
    private readonly audit: AuditTrail,
  ) {}

  async execute(donorId: string): Promise<{ userId: string }> {
    const donor = await loadDonorOrFail(this.donors, donorId);
    const { userId } = donor;
    donor.anonymize();
    // Os motivos (texto livre) saem primeiro: se a gravação do doador falhar depois, o pedido é
    // repetido (tudo aqui é idempotente) e nenhum dado identificante sobra. Na ordem inversa, uma
    // falha deixaria o doador já anonimizado com os motivos ainda legíveis.
    await this.unfitness.replaceReasons(donorId, TEXT_ANONYMIZED);
    await this.donors.save(donor);
    await this.audit.record(donorId, { sub: userId, role: Role.DONOR }, AuditAction.ANONYMIZATION);
    return { userId };
  }
}
