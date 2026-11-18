import { cpfIndex, nameWordIndexes } from '@shared/infrastructure/persistence';
import { AccessAuditMapper } from '@src/infrastructure/persistence/mappers/access-audit.mapper';
import { EligibilityAssessmentMapper } from '@src/infrastructure/persistence/mappers/assessment-eligibility.mapper';
import { DonorMapper } from '@src/infrastructure/persistence/mappers/donor.mapper';
import { TemporaryUnfitnessMapper } from '@src/infrastructure/persistence/mappers/temporary-unfitness.mapper';
import { AccessAuditOrmEntity } from '@src/infrastructure/persistence/orm-entities/access-audit.orm-entity';
import { EligibilityAssessmentOrmEntity } from '@src/infrastructure/persistence/orm-entities/assessment-eligibility.orm-entity';
import { DonorOrmEntity } from '@src/infrastructure/persistence/orm-entities/donor.orm-entity';
import { TemporaryUnfitnessOrmEntity } from '@src/infrastructure/persistence/orm-entities/temporary-unfitness.orm-entity';

const now = new Date('2026-10-02T12:00:00Z');

describe('mappers do eligibility', () => {
  it('Donor: converte o numeric do Postgres (string) em number e faz o caminho de volta', () => {
    const orm = Object.assign(new DonorOrmEntity(), {
      id: 'd1',
      userId: 'u1',
      completeName: 'Maria',
      cpf: '12345678901',
      birthDate: '1990-01-01',
      sex: 'F',
      phone: '1',
      email: 'm@x.com',
      weightKg: '62.50',
      bloodType: null,
      lastDonationAt: null,
      permanentUnfit: false,
      permanentUnfitnessReason: null,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    const donor = DonorMapper.toDomain(orm);
    expect(donor.weightKg).toBe(62.5);
    const back = DonorMapper.toOrm(donor);
    expect(back).toBeInstanceOf(DonorOrmEntity);
    expect(back).toMatchObject({ id: 'd1', weightKg: 62.5, completeName: 'Maria', active: true });
    // Os índices cegos (CPF e palavras do nome) acompanham os dados cifrados.
    expect(back.cpfIndex).toBe(cpfIndex('12345678901'));
    expect(back.nameIndexes).toEqual(nameWordIndexes('Maria'));
  });

  it('Donor: campos opcionais ausentes viram null', () => {
    const orm = Object.assign(new DonorOrmEntity(), {
      id: 'd1',
      userId: 'u1',
      completeName: 'A',
      cpf: '1',
      birthDate: '1990-01-01',
      sex: 'M',
      phone: '1',
      email: 'a@x.com',
      weightKg: 70,
      permanentUnfit: false,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    const donor = DonorMapper.toDomain(orm);
    expect(donor.bloodType).toBeNull();
    expect(donor.lastDonationAt).toBeNull();
    expect(donor.permanentUnfitnessReason).toBeNull();
  });

  it('TemporaryUnfitness: ida e volta preservando as datas e o autor', () => {
    const orm = Object.assign(new TemporaryUnfitnessOrmEntity(), {
      id: 'i1',
      donorId: 'd1',
      reason: 'gripe',
      category: 'ILLNESS',
      startDate: '2026-09-01',
      expectedEndDate: '2026-09-10',
      actualEndDate: undefined,
      registeredBy: undefined,
      createdAt: now,
    });
    const unfitness = TemporaryUnfitnessMapper.toDomain(orm);
    expect(unfitness.actualEndDate).toBeNull();
    expect(unfitness.registeredBy).toBeNull();
    expect(TemporaryUnfitnessMapper.toOrm(unfitness)).toMatchObject({
      id: 'i1',
      donorId: 'd1',
      expectedEndDate: '2026-09-10',
      actualEndDate: null,
    });
  });

  it('EligibilityAssessment: todos os campos preenchidos chegam ao domínio', () => {
    const orm = Object.assign(new EligibilityAssessmentOrmEntity(), {
      id: 'a1',
      donorId: 'd1',
      appointmentId: 'ap1',
      result: 'TEMPORARY_UNFIT',
      reasons: ['INSUFFICIENT_WEIGHT'],
      nextEligibilityDate: '2026-12-01',
      origin: 'APPOINTMENT_VALIDATION',
      assessedAt: now,
    });
    const assessment = EligibilityAssessmentMapper.toDomain(orm);
    expect(assessment).toMatchObject({
      id: 'a1',
      donorId: 'd1',
      appointmentId: 'ap1',
      result: 'TEMPORARY_UNFIT',
      reasons: ['INSUFFICIENT_WEIGHT'],
      nextEligibilityDate: '2026-12-01',
      origin: 'APPOINTMENT_VALIDATION',
      assessedAt: now,
    });
  });

  it('EligibilityAssessment: campos opcionais ausentes viram null', () => {
    const orm = Object.assign(new EligibilityAssessmentOrmEntity(), {
      id: 'a1',
      donorId: 'd1',
      result: 'ELIGIBLE',
      reasons: [],
      origin: 'DONOR_QUERY',
      assessedAt: now,
    });
    const assessment = EligibilityAssessmentMapper.toDomain(orm);
    expect(assessment.appointmentId).toBeNull();
    expect(assessment.nextEligibilityDate).toBeNull();
    expect(assessment.reasons).toEqual([]);
  });

  it('AccessAudit: userId ausente (anonimização) vira null', () => {
    const orm = Object.assign(new AccessAuditOrmEntity(), {
      id: 'x1',
      donorId: 'd1',
      userRole: 'DONOR',
      action: 'VIEW',
      createdAt: now,
    });
    const audit = AccessAuditMapper.toDomain(orm);
    expect(audit.userId).toBeNull();
    expect(audit.action).toBe('VIEW');
  });
});
