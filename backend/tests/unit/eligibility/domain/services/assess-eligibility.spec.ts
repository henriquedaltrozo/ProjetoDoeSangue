import { IneligibilityReason, EligibilityResult, Sex } from '@shared/domain/enums';
import {
  FIXED_NOW,
  createTestDonor,
  createTestUnfitness,
  dateWithOffset,
} from '@test/support/fixtures.fake';
import { assessEligibility, minIntervalMonths } from '@src/domain/services/assess-eligibility';
import { addMonths } from '@src/domain/services/dates';

describe('assessEligibility (função pura)', () => {
  const assess = (donor = createTestDonor(), activeUnfitness = null as any) =>
    assessEligibility({ donor, activeUnfitness, now: FIXED_NOW });

  it('intervalo mínimo: 2 meses para homens e 3 para mulheres', () => {
    expect(minIntervalMonths(Sex.M)).toBe(2);
    expect(minIntervalMonths(Sex.F)).toBe(3);
  });

  it('ELIGIBLE sem motivos', () => {
    expect(assess()).toEqual({
      result: EligibilityResult.ELIGIBLE,
      reasons: [],
      nextEligibilityDate: null,
      notices: [],
    });
  });

  it('inapto permanente ignora as demais regras e não tem próxima data', () => {
    const r = assess(createTestDonor({ permanentUnfit: true, weightKg: 10 }));
    expect(r.result).toBe(EligibilityResult.PERMANENT_UNFIT);
    expect(r.reasons).toEqual([IneligibilityReason.PERMANENT_UNFIT]);
    expect(r.nextEligibilityDate).toBeNull();
  });

  it('acumula motivos e usa a maior data candidata como próxima elegibilidade', () => {
    const donor = createTestDonor({ lastDonationAt: dateWithOffset(-10) });
    const r = assess(donor, createTestUnfitness({ expectedEndDate: dateWithOffset(5) }));
    expect(r.reasons).toEqual([
      IneligibilityReason.ACTIVE_TEMPORARY_UNFITNESS,
      IneligibilityReason.MIN_INTERVAL_NOT_FULFILLED,
    ]);
    expect(r.nextEligibilityDate).toBe(addMonths(dateWithOffset(-10), 2));
  });

  it('inaptidão ativa sem data prevista não define próxima elegibilidade', () => {
    const r = assess(createTestDonor(), createTestUnfitness({ expectedEndDate: null }));
    expect(r.result).toBe(EligibilityResult.TEMPORARY_UNFIT);
    expect(r.nextEligibilityDate).toBeNull();
  });

  it('idade mínima conta pelo dia em Brasília: na véspera dos 16 anos, às 22h, ainda é menor', () => {
    const donor = createTestDonor({
      birthDate: '2010-10-29',
      guardianName: 'Maria Responsável',
      guardianConsentDeclared: true,
    });
    const eveAt22hBrasilia = new Date('2026-10-29T01:00:00.000Z');
    const birthdayMorning = new Date('2026-10-29T12:00:00.000Z');
    expect(
      assessEligibility({ donor, activeUnfitness: null, now: eveAt22hBrasilia }).reasons,
    ).toEqual([IneligibilityReason.AGE_BELOW_MIN]);
    expect(
      assessEligibility({ donor, activeUnfitness: null, now: birthdayMorning }).reasons,
    ).toEqual([]);
  });

  it('peso exatamente no mínimo (50 kg) é aceito', () => {
    expect(assess(createTestDonor({ weightKg: 50 })).result).toBe(EligibilityResult.ELIGIBLE);
  });

  it('doação exatamente há 2 meses libera o homem; um dia antes não', () => {
    expect(assess(createTestDonor({ lastDonationAt: '2026-08-02' })).result).toBe(
      EligibilityResult.ELIGIBLE,
    );
    expect(assess(createTestDonor({ lastDonationAt: '2026-08-03' })).result).toBe(
      EligibilityResult.TEMPORARY_UNFIT,
    );
  });
});

describe('próxima elegibilidade de menores de 16 anos', () => {
  it('é o aniversário de 16 anos', () => {
    const donor = createTestDonor({ birthDate: '2011-03-15' });
    const r = assessEligibility({ donor, activeUnfitness: null, now: FIXED_NOW });
    expect(r.reasons).toEqual([IneligibilityReason.AGE_BELOW_MIN]);
    expect(r.nextEligibilityDate).toBe('2027-03-15');
  });

  it('vale para datas comuns e para 29/02 quando o ano dos 16 também é bissexto', () => {
    const donor = createTestDonor({ birthDate: '2011-02-28' });
    expect(
      assessEligibility({ donor, activeUnfitness: null, now: FIXED_NOW }).nextEligibilityDate,
    ).toBe('2027-02-28');
    const leapBorn = createTestDonor({ birthDate: '2012-02-29' });
    expect(
      assessEligibility({ donor: leapBorn, activeUnfitness: null, now: FIXED_NOW })
        .nextEligibilityDate,
    ).toBe('2028-02-29');
  });
});
