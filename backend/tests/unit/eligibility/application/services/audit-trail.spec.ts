import { Role } from '@shared/domain/enums';
import { ListAuditUseCase } from '@src/application/use-cases/list-audit.use-case';
import { AuditAction } from '@src/domain/entities/access-audit';
import { ADMIN_ACTOR } from '@test/support/fixtures.fake';
import { buildAuditTrail } from '@test/support/in-memory-repositories.fake';

describe('AuditTrail', () => {
  it('registra o acesso com usuário, papel e ação', async () => {
    const { trail, accesses } = buildAuditTrail();
    await trail.record('donor-1', ADMIN_ACTOR, AuditAction.VIEW);
    expect(accesses.items).toHaveLength(1);
    expect(accesses.items[0]).toMatchObject({
      donorId: 'donor-1',
      userId: 'admin-1',
      userRole: Role.ADMIN,
      action: AuditAction.VIEW,
    });
  });

  it('nunca lança: falha ao gravar é só logada', async () => {
    const { trail, accesses, logger } = buildAuditTrail();
    accesses.failOnCreate = true;
    await expect(
      trail.record('donor-1', { sub: 'user-1', role: Role.DONOR }, AuditAction.ANONYMIZATION),
    ).resolves.toBeUndefined();
    expect(logger.errors).toHaveLength(1);
    expect(logger.errors[0]).toContain('donorId=donor-1');
    expect(logger.errors[0]).toContain('banco indisponível');
  });
});

describe('ListAuditUseCase', () => {
  it('lista o histórico do doador, mais recentes primeiro', async () => {
    const { trail, accesses } = buildAuditTrail();
    await trail.record('donor-1', ADMIN_ACTOR, AuditAction.VIEW);
    await trail.record('donor-1', ADMIN_ACTOR, AuditAction.UPDATE);
    await trail.record('donor-2', ADMIN_ACTOR, AuditAction.EXPORT);

    const history = await new ListAuditUseCase(accesses).execute('donor-1');
    expect(history.map((a) => a.action)).toEqual([AuditAction.UPDATE, AuditAction.VIEW]);
  });
});
