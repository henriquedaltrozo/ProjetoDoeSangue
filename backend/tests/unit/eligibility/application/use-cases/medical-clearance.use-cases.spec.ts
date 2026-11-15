import { BusinessRuleError } from '@src/domain/errors';
import { AuditAction } from '@src/domain/entities/access-audit';
import { RegisterMedicalClearanceUseCase } from '@src/application/use-cases/register-medical-clearance.use-case';
import { RevokeMedicalClearanceUseCase } from '@src/application/use-cases/revoke-medical-clearance.use-case';
import { ADMIN_ACTOR, createTestDonor } from '@test/support/fixtures.fake';
import {
  FixedClock,
  InMemoryDonorRepository,
  buildAuditTrail,
} from '@test/support/in-memory-repositories.fake';

describe('avaliação médica (70 anos ou mais)', () => {
  let donors: InMemoryDonorRepository;
  let audit: ReturnType<typeof buildAuditTrail>;

  beforeEach(() => {
    donors = new InMemoryDonorRepository();
    audit = buildAuditTrail();
  });

  it('o admin registra a avaliação favorável de um doador regular, com auditoria', async () => {
    donors.seed(createTestDonor({ birthDate: '1950-01-01', regularDonorDeclared: true }));
    const useCase = new RegisterMedicalClearanceUseCase(donors, new FixedClock(), audit.trail);

    const donor = await useCase.execute('donor-1', ADMIN_ACTOR);

    expect(donor.medicalClearanceAt).toBe('2026-10-02');
    expect(audit.accesses.items.map((a) => a.action)).toEqual([AuditAction.UPDATE]);
  });

  it('recusa registrar para quem não declarou ser doador regular', async () => {
    donors.seed(createTestDonor({ birthDate: '1950-01-01' }));
    const useCase = new RegisterMedicalClearanceUseCase(donors, new FixedClock(), audit.trail);

    await expect(useCase.execute('donor-1', ADMIN_ACTOR)).rejects.toBeInstanceOf(BusinessRuleError);
    expect(donors.saves).toBe(0);
  });

  it('o admin desfaz a avaliação', async () => {
    donors.seed(
      createTestDonor({
        birthDate: '1950-01-01',
        regularDonorDeclared: true,
        medicalClearanceAt: '2026-09-01',
      }),
    );
    const donor = await new RevokeMedicalClearanceUseCase(donors, audit.trail).execute(
      'donor-1',
      ADMIN_ACTOR,
    );
    expect(donor.medicalClearanceAt).toBeNull();
  });
});
