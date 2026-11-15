import { CLOCK, type Clock } from '@shared/application/ports';
import { Role } from '@shared/domain/enums';
import { AuditAction } from '../../domain/entities/access-audit';
import { InvalidEntryError } from '../errors';
import { DONOR_REPOSITORY, type DonorRepository } from '../ports/donor.repository';
import { UNSUBSCRIBE_TOKENS, type UnsubscribeTokens } from '../ports/unsubscribe-tokens.port';
import { AuditTrail } from '../services/audit-trail';

/**
 * Link "não quero mais receber estes avisos" dos e-mails de campanha e de "já pode doar": desmarca
 * a preferência `receiveAlerts` do doador, sem login (o token assinado prova de quem é o link).
 * Idempotente: repetir (ou um doador que já desmarcou, ou uma conta excluída) não muda nada.
 * Auditado em nome do titular.
 */
export class UnsubscribeAlertsUseCase {
  static readonly inject = [UNSUBSCRIBE_TOKENS, DONOR_REPOSITORY, CLOCK, AuditTrail] as const;

  constructor(
    private readonly tokens: UnsubscribeTokens,
    private readonly donors: DonorRepository,
    private readonly clock: Clock,
    private readonly audit: AuditTrail,
  ) {}

  async execute(token: string | undefined): Promise<void> {
    const donorId = token ? this.tokens.verify(token) : null;
    if (!donorId) {
      throw new InvalidEntryError(
        'Link inválido. Use o link do e-mail ou desmarque a opção em Meu perfil.',
      );
    }
    const donor = await this.donors.findById(donorId);
    if (!donor?.active || !donor.receiveAlerts) return;
    donor.updateProfile({ receiveAlerts: false }, this.clock.now());
    await this.donors.save(donor);
    await this.audit.record(donor.id, { sub: donor.userId, role: Role.DONOR }, AuditAction.UPDATE);
  }
}
