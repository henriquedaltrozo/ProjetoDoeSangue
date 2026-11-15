import { BloodType, Sex } from '@shared/domain/enums';
import { AccessDeniedError, NotFoundError } from '@src/application/errors';
import { UpdateDonorUseCase } from '@src/application/use-cases/update-donor.use-case';
import { AuditAction } from '@src/domain/entities/access-audit';
import { ADMIN_ACTOR, createTestDonor, donorActor } from '@test/support/fixtures.fake';
import {
  FixedClock,
  InMemoryDonorRepository,
  buildAuditTrail,
} from '@test/support/in-memory-repositories.fake';

describe('UpdateDonorUseCase', () => {
  let donors: InMemoryDonorRepository;
  let audit: ReturnType<typeof buildAuditTrail>;
  let useCase: UpdateDonorUseCase;

  beforeEach(() => {
    donors = new InMemoryDonorRepository();
    donors.seed(createTestDonor({ bloodType: null }));
    audit = buildAuditTrail();
    useCase = new UpdateDonorUseCase(donors, audit.trail, new FixedClock());
  });

  it('atualiza somente os campos informados e audita a alteração (UPDATE)', async () => {
    const donor = await useCase.execute(
      'donor-1',
      { bloodType: BloodType.A_POSITIVE },
      donorActor('donor-1'),
    );
    expect(donor.bloodType).toBe(BloodType.A_POSITIVE);
    expect(donor.phone).toBe('11999998888');
    expect(donors.saves).toBe(1);
    expect(audit.accesses.items).toEqual([
      expect.objectContaining({ donorId: 'donor-1', action: AuditAction.UPDATE }),
    ]);
  });

  it('corrige dados pessoais e a última doação', async () => {
    const donor = await useCase.execute(
      'donor-1',
      { cpf: '52998224725', sex: Sex.F, weightKg: 61, lastDonationDate: '2026-09-01' },
      donorActor('donor-1'),
    );
    expect(donor).toMatchObject({
      cpf: '52998224725',
      sex: Sex.F,
      weightKg: 61,
      lastDonationAt: '2026-09-01',
    });
  });

  it('outro doador não pode alterar o perfil, e nada é gravado nem auditado', async () => {
    await expect(
      useCase.execute('donor-1', { bloodType: BloodType.A_POSITIVE }, donorActor('donor-2')),
    ).rejects.toBeInstanceOf(AccessDeniedError);
    expect(donors.saves).toBe(0);
    expect(audit.accesses.items).toHaveLength(0);
  });

  it('lança NotFoundError ao atualizar um doador inexistente', async () => {
    await expect(
      useCase.execute('not-exists', { bloodType: BloodType.A_POSITIVE }, ADMIN_ACTOR),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
