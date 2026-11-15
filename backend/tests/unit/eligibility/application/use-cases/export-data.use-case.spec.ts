import { IneligibilityReason, AssessmentSource, EligibilityResult } from '@shared/domain/enums';
import { EligibilityAssessment } from '@src/domain/entities/assessment-eligibility';
import { AccessDeniedError, NotFoundError } from '@src/application/errors';
import { AuditAction } from '@src/domain/entities/access-audit';
import { ExportDataUseCase } from '@src/application/use-cases/export-data.use-case';
import {
  InMemoryAssessmentRepository,
  InMemoryDonorRepository,
  InMemoryUnfitnessRepository,
  buildAuditTrail,
} from '@test/support/in-memory-repositories.fake';
import {
  ADMIN_ACTOR,
  FIXED_NOW,
  createTestDonor,
  createTestUnfitness,
  donorActor,
} from '@test/support/fixtures.fake';

describe('ExportDataUseCase', () => {
  let donors: InMemoryDonorRepository;
  let unfitness: InMemoryUnfitnessRepository;
  let assessments: InMemoryAssessmentRepository;
  let audit: ReturnType<typeof buildAuditTrail>;
  let useCase: ExportDataUseCase;

  beforeEach(() => {
    donors = new InMemoryDonorRepository();
    unfitness = new InMemoryUnfitnessRepository();
    assessments = new InMemoryAssessmentRepository();
    audit = buildAuditTrail();
    useCase = new ExportDataUseCase(donors, unfitness, assessments, audit.trail);
  });

  it('reúne doador, inaptidões e avaliações num único payload', async () => {
    donors.seed(createTestDonor());
    unfitness.seed(createTestUnfitness(), createTestUnfitness({ id: 'other', donorId: 'x' }));
    assessments.seed(
      new EligibilityAssessment({
        id: 'assessment-1',
        donorId: 'donor-1',
        appointmentId: null,
        result: EligibilityResult.TEMPORARY_UNFIT,
        reasons: [IneligibilityReason.INSUFFICIENT_WEIGHT],
        nextEligibilityDate: null,
        origin: AssessmentSource.DONOR_QUERY,
        assessedAt: FIXED_NOW,
      }),
    );

    const exported = await useCase.execute('donor-1', donorActor('donor-1'));

    expect(exported.donor.id).toBe('donor-1');
    expect(exported.temporaryUnfitness.map((i) => i.id)).toEqual(['unfitness-1']);
    expect(exported.eligibilityAssessments.map((a) => a.id)).toEqual(['assessment-1']);
    expect(audit.accesses.items.map((a) => a.action)).toEqual([AuditAction.EXPORT]);
  });

  it('outro doador não pode exportar os dados, e nada é auditado', async () => {
    donors.seed(createTestDonor());
    await expect(useCase.execute('donor-1', donorActor('donor-2'))).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
    expect(audit.accesses.items).toHaveLength(0);
  });

  it('lança NotFoundError ao exportar um doador inexistente', async () => {
    await expect(useCase.execute('not-exists', ADMIN_ACTOR)).rejects.toBeInstanceOf(NotFoundError);
  });
});
