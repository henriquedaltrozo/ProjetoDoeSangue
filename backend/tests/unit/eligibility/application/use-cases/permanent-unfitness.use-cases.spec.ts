import { BusinessRuleError, InvalidValueError } from '@src/domain/errors';
import { AuditAction } from '@src/domain/entities/access-audit';
import { RegisterPermanentUnfitnessUseCase } from '@src/application/use-cases/register-permanent-unfitness.use-case';
import { RevokePermanentUnfitnessUseCase } from '@src/application/use-cases/revoke-permanent-unfitness.use-case';
import { ADMIN_ACTOR, createTestDonor } from '@test/support/fixtures.fake';
import {
  InMemoryDonorRepository,
  buildAuditTrail,
} from '@test/support/in-memory-repositories.fake';

describe('inaptidão permanente', () => {
  let donors: InMemoryDonorRepository;
  let audit: ReturnType<typeof buildAuditTrail>;

  beforeEach(() => {
    donors = new InMemoryDonorRepository();
    audit = buildAuditTrail();
  });

  it('o admin registra com o motivo, com auditoria', async () => {
    donors.seed(createTestDonor());
    const useCase = new RegisterPermanentUnfitnessUseCase(donors, audit.trail);

    const donor = await useCase.execute('donor-1', '  Hepatite B  ', ADMIN_ACTOR);

    expect(donor.permanentUnfit).toBe(true);
    expect(donor.permanentUnfitnessReason).toBe('Hepatite B');
    expect(audit.accesses.items.map((a) => a.action)).toEqual([AuditAction.UPDATE]);
  });

  it('exige o motivo e não registra duas vezes', async () => {
    donors.seed(createTestDonor());
    const useCase = new RegisterPermanentUnfitnessUseCase(donors, audit.trail);

    await expect(useCase.execute('donor-1', ' ', ADMIN_ACTOR)).rejects.toBeInstanceOf(
      InvalidValueError,
    );
    await useCase.execute('donor-1', 'Hepatite B', ADMIN_ACTOR);
    await expect(useCase.execute('donor-1', 'Outro', ADMIN_ACTOR)).rejects.toBeInstanceOf(
      BusinessRuleError,
    );
  });

  it('o admin desfaz, e o motivo é apagado', async () => {
    donors.seed(createTestDonor({ permanentUnfit: true, permanentUnfitnessReason: 'Engano' }));
    const useCase = new RevokePermanentUnfitnessUseCase(donors, audit.trail);

    const donor = await useCase.execute('donor-1', ADMIN_ACTOR);

    expect(donor.permanentUnfit).toBe(false);
    expect(donor.permanentUnfitnessReason).toBeNull();
  });

  it('desfazer quando não há inaptidão é recusado', async () => {
    donors.seed(createTestDonor());
    await expect(
      new RevokePermanentUnfitnessUseCase(donors, audit.trail).execute('donor-1', ADMIN_ACTOR),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });
});
