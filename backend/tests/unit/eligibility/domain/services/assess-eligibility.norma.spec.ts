import {
  AssessmentNotice,
  EligibilityResult,
  IneligibilityReason as R,
  Sex,
} from '@shared/domain/enums';
import { FIXED_NOW, createTestDonor, createTestUnfitness } from '@test/support/fixtures.fake';
import { assessEligibility } from '@src/domain/services/assess-eligibility';
import type { DonorProps } from '@src/domain/entities/donor';

/**
 * Casos de teste das regras de elegibilidade (peso e intervalo/limite anual: Portaria GM/MS nº 11.685/2026,
 * art. 38 e 40; idade: regras adotadas pelo projeto, ver eligibility-rules.constants), usados para verificar a hipótese H2.
 * "Hoje" é 2026-10-02 (FIXED_NOW). Cada tabela cobre os valores imediatamente abaixo, iguais e acima do limite.
 */
const run = (overrides: Partial<DonorProps>, unfitness = null as any) =>
  assessEligibility({
    donor: createTestDonor(overrides),
    activeUnfitness: unfitness,
    now: FIXED_NOW,
  });

/** Avaliação de um agendamento: as regras de idade valem no dia da doação. */
const runOn = (donationDate: string, overrides: Partial<DonorProps>) =>
  assessEligibility({
    donor: createTestDonor(overrides),
    activeUnfitness: null,
    now: FIXED_NOW,
    donationDate,
  });

// Doador de repetição que já doava antes dos 60 (evita a regra dos 60 a 69) e com intervalo cumprido.
const repeat = {
  lastDonationAt: '2026-01-05',
  donationDates: ['2026-01-05'],
  donatedBefore60: true,
};

describe('Norma - idade', () => {
  // Menor com o responsável informado e o termo confirmado.
  const guardian = { guardianName: 'Maria Responsável', guardianConsentDeclared: true };

  it.each([
    ['15 anos e 364 dias (um dia antes de completar 16)', '2010-10-03', [R.AGE_BELOW_MIN]],
    ['exatamente 16 anos hoje', '2010-10-02', []],
    ['16 anos e 1 dia', '2010-10-01', []],
  ])('idade mínima (com consentimento do responsável): %s', (_d, birthDate, reasons) => {
    expect(run({ birthDate, ...guardian }).reasons).toEqual(reasons);
  });

  it.each([
    [
      '16 anos, sem o responsável informado',
      { birthDate: '2010-10-01' },
      [R.GUARDIAN_CONSENT_REQUIRED],
    ],
    [
      '17 anos, responsável informado mas termo não confirmado',
      { birthDate: '2009-05-01', guardianName: 'Maria Responsável' },
      [R.GUARDIAN_CONSENT_REQUIRED],
    ],
    ['18 anos hoje: não precisa mais do responsável', { birthDate: '2008-10-02' }, []],
  ])('menores de 18: %s', (_d, overrides, reasons) => {
    expect(run(overrides as Partial<DonorProps>).reasons).toEqual(reasons);
  });

  it('menor apto recebe o aviso para levar o termo assinado', () => {
    const r = run({ birthDate: '2009-05-01', ...guardian });
    expect(r.result).toBe(EligibilityResult.ELIGIBLE);
    expect(r.notices).toEqual([AssessmentNotice.BRING_GUARDIAN_CONSENT]);
  });

  it.each([
    ['69 anos, 11 meses e 29 dias (véspera dos 70 anos)', '1956-10-03', []],
    ['exatamente 70 anos hoje', '1956-10-02', [R.AGE_ABOVE_MAX]],
    ['70 anos e 1 dia', '1956-10-01', [R.AGE_ABOVE_MAX]],
  ])('idade máxima (doador de repetição, não regular): %s', (_d, birthDate, reasons) => {
    expect(run({ birthDate, ...repeat }).reasons).toEqual(reasons);
  });

  it.each([
    [
      'doador regular sem avaliação médica',
      { regularDonorDeclared: true },
      [R.MEDICAL_CLEARANCE_REQUIRED],
    ],
    [
      'doador regular com avaliação médica favorável',
      { regularDonorDeclared: true, medicalClearanceAt: '2026-09-15' },
      [],
    ],
    [
      'avaliação de 12 meses atrás menos um dia: ainda vale hoje (último dia)',
      { regularDonorDeclared: true, medicalClearanceAt: '2025-10-03' },
      [],
    ],
    [
      'avaliação de exatamente 12 meses atrás: venceu',
      { regularDonorDeclared: true, medicalClearanceAt: '2025-10-02' },
      [R.MEDICAL_CLEARANCE_REQUIRED],
    ],
  ])('70 anos ou mais: %s', (_d, overrides, reasons) => {
    expect(run({ birthDate: '1955-03-01', ...repeat, ...overrides }).reasons).toEqual(reasons);
  });

  it.each([
    ['59 anos, 11 meses e 29 dias (véspera dos 60 anos)', '1966-10-03', []],
    ['exatamente 60 anos hoje', '1966-10-02', [R.AGE_ABOVE_MAX_FIRST_DONATION]],
    ['60 anos e 1 dia', '1966-10-01', [R.AGE_ABOVE_MAX_FIRST_DONATION]],
  ])('de 60 a 69 anos, sem doação antes dos 60: %s', (_d, birthDate, reasons) => {
    expect(run({ birthDate }).reasons).toEqual(reasons);
  });

  it('de 60 a 69 anos pode doar quem declarou ter doado antes dos 60', () => {
    expect(run({ birthDate: '1960-01-01', donatedBefore60: true }).result).toBe(
      EligibilityResult.ELIGIBLE,
    );
  });

  it('de 60 a 69 anos pode doar quem tem doação registrada antes dos 60', () => {
    expect(run({ birthDate: '1960-01-01', lastDonationAt: '2019-06-01' }).result).toBe(
      EligibilityResult.ELIGIBLE,
    );
  });

  it('uma doação conhecida feita depois dos 60 não prova doação antes dos 60', () => {
    expect(
      run({ birthDate: '1960-01-01', lastDonationAt: '2026-01-05', donationDates: ['2026-01-05'] })
        .reasons,
    ).toEqual([R.AGE_ABOVE_MAX_FIRST_DONATION]);
  });

  it('declarar que não doou antes dos 60 mantém a inaptidão', () => {
    expect(run({ birthDate: '1960-01-01', donatedBefore60: false }).reasons).toEqual([
      R.AGE_ABOVE_MAX_FIRST_DONATION,
    ]);
  });
});

describe('Norma - idade no dia da doação agendada', () => {
  it('quem tem 69 anos hoje e agenda para depois dos 70 doaria com 70', () => {
    expect(runOn('2026-10-12', { birthDate: '1956-10-10', ...repeat }).reasons).toEqual([
      R.AGE_ABOVE_MAX,
    ]);
    expect(runOn('2026-10-09', { birthDate: '1956-10-10', ...repeat }).reasons).toEqual([]);
  });

  it('quem tem 59 anos, nunca doou e agenda para depois dos 60 cai na regra dos 60', () => {
    expect(runOn('2026-10-15', { birthDate: '1966-10-10' }).reasons).toEqual([
      R.AGE_ABOVE_MAX_FIRST_DONATION,
    ]);
  });

  it('quem tem 15 anos e agenda para depois dos 16 pode doar', () => {
    const guardian = { guardianName: 'Maria Responsável', guardianConsentDeclared: true };
    expect(runOn('2026-10-15', { birthDate: '2010-10-10', ...guardian }).reasons).toEqual([]);
  });

  it('a avaliação médica precisa valer no dia da doação', () => {
    const regular = {
      birthDate: '1950-01-01',
      ...repeat,
      regularDonorDeclared: true,
      medicalClearanceAt: '2026-09-15',
    };
    expect(runOn('2027-09-14', regular).reasons).toEqual([]);
    expect(runOn('2027-09-15', regular).reasons).toEqual([R.MEDICAL_CLEARANCE_REQUIRED]);
  });

  it('um dia de doação no passado é ignorado (vale hoje)', () => {
    expect(runOn('2020-01-01', { birthDate: '1956-10-03', ...repeat }).reasons).toEqual([]);
  });
});

describe('Norma - intervalo e limite anual no dia da doação agendada', () => {
  // "Hoje" é 2026-10-02. Quem agenda para depois do fim do intervalo pode doar nesse dia.
  it('intervalo mínimo: conta até o dia da doação, não até hoje', () => {
    const man = { sex: Sex.M, lastDonationAt: '2026-09-01', donationDates: ['2026-09-01'] };
    expect(runOn('2026-11-01', man).reasons).toEqual([]);
    expect(runOn('2026-10-31', man).reasons).toEqual([R.MIN_INTERVAL_NOT_FULFILLED]);
  });

  it('limite anual: a doação mais antiga sai da janela de 12 meses até o dia da doação', () => {
    const woman = {
      sex: Sex.F,
      lastDonationAt: '2026-07-10',
      donationDates: ['2025-11-10', '2026-03-10', '2026-07-10'],
    };
    expect(runOn('2026-11-10', woman).reasons).toEqual([]);
    expect(runOn('2026-11-09', woman).reasons).toEqual([R.MAX_ANNUAL_DONATIONS_REACHED]);
  });
});

describe('Norma - peso mínimo (art. 40)', () => {
  it.each([
    [49, [R.INSUFFICIENT_WEIGHT]],
    [49.9, [R.INSUFFICIENT_WEIGHT]],
    [50, []],
    [50.1, []],
    [70, []],
  ])('peso de %s kg', (weightKg, reasons) => {
    expect(run({ weightKg }).reasons).toEqual(reasons);
  });
});

describe('Norma - intervalo mínimo entre doações (art. 38, §1º)', () => {
  it.each([
    [
      Sex.M,
      'um dia antes de completar 2 meses',
      '2026-08-03',
      [R.MIN_INTERVAL_NOT_FULFILLED],
      '2026-10-03',
    ],
    [Sex.M, 'exatamente 2 meses', '2026-08-02', [], null],
    [Sex.M, 'mais de 2 meses', '2026-08-01', [], null],
    [
      Sex.F,
      'um dia antes de completar 3 meses',
      '2026-07-03',
      [R.MIN_INTERVAL_NOT_FULFILLED],
      '2026-10-03',
    ],
    [Sex.F, 'exatamente 3 meses', '2026-07-02', [], null],
    [Sex.F, 'mais de 3 meses', '2026-07-01', [], null],
    [
      Sex.F,
      'homem liberado após 2 meses, mulher ainda não (mesma data)',
      '2026-08-02',
      [R.MIN_INTERVAL_NOT_FULFILLED],
      '2026-11-02',
    ],
    [Sex.M, 'doação hoje', '2026-10-02', [R.MIN_INTERVAL_NOT_FULFILLED], '2026-12-02'],
  ])('%s: %s (última doação %s)', (sex, _d, lastDonationAt, reasons, next) => {
    const r = run({ sex, lastDonationAt, donationDates: [lastDonationAt] });
    expect(r.reasons).toEqual(reasons);
    expect(r.nextEligibilityDate).toBe(next);
  });

  it('meses curtos: doação em 31/12 libera o homem em 28/02', () => {
    const donor = createTestDonor({ lastDonationAt: '2026-12-31', donationDates: ['2026-12-31'] });
    const day = (iso: string) => new Date(`${iso}T15:00:00.000Z`);
    expect(
      assessEligibility({ donor, activeUnfitness: null, now: day('2027-02-27') }).reasons,
    ).toEqual([R.MIN_INTERVAL_NOT_FULFILLED]);
    expect(
      assessEligibility({ donor, activeUnfitness: null, now: day('2027-02-28') }).reasons,
    ).toEqual([]);
  });
});

describe('Norma - máximo de doações em 12 meses (art. 38)', () => {
  const blocked = [R.MAX_ANNUAL_DONATIONS_REACHED];

  it.each([
    // homem: 3 doações na janela, ainda pode doar; 4, não
    [Sex.M, '3 doações na janela', ['2025-11-01', '2026-01-05', '2026-03-10'], [], null],
    [
      Sex.M,
      '4 doações na janela',
      ['2025-11-01', '2026-01-05', '2026-03-10', '2026-06-01'],
      blocked,
      '2026-11-01',
    ],
    [
      Sex.M,
      '5 doações na janela (libera ao sair a segunda mais antiga)',
      ['2025-10-20', '2025-11-01', '2026-01-05', '2026-03-10', '2026-06-01'],
      blocked,
      '2026-11-01',
    ],
    // mulher: 2 doações na janela, ainda pode doar; 3, não
    [Sex.F, '2 doações na janela', ['2025-12-01', '2026-03-01'], [], null],
    [
      Sex.F,
      '3 doações na janela',
      ['2025-12-01', '2026-03-01', '2026-06-20'],
      blocked,
      '2026-12-01',
    ],
  ])('%s: %s', (sex, _d, dates, reasons, next) => {
    const r = run({
      sex,
      donationDates: dates as string[],
      lastDonationAt: (dates as string[]).at(-1),
    });
    expect(r.reasons).toEqual(reasons);
    expect(r.nextEligibilityDate).toBe(next);
  });

  it('a doação feita exatamente há 12 meses já saiu da janela; a de 12 meses menos um dia ainda conta', () => {
    const base = ['2026-01-05', '2026-03-10', '2026-06-01'];
    expect(
      run({ donationDates: ['2025-10-02', ...base], lastDonationAt: '2026-06-01' }).reasons,
    ).toEqual([]);
    expect(
      run({ donationDates: ['2025-10-03', ...base], lastDonationAt: '2026-06-01' }).reasons,
    ).toEqual(blocked);
  });

  it('doador sem histórico detalhado conta a última doação (compatibilidade com dados anteriores)', () => {
    expect(run({ ...repeat, donationDates: [] }).reasons).toEqual([]);
  });
});

describe('Norma - inaptidões e combinação de motivos', () => {
  it('inaptidão permanente encerra a avaliação', () => {
    const r = run({ permanentUnfit: true, weightKg: 10, birthDate: '2015-01-01' });
    expect(r.result).toBe(EligibilityResult.PERMANENT_UNFIT);
    expect(r.reasons).toEqual([R.PERMANENT_UNFIT]);
  });

  it('inaptidão temporária vale até a data prevista (inclusive): a próxima data é o dia seguinte', () => {
    const active = run(
      {},
      createTestUnfitness({ startDate: '2026-09-01', expectedEndDate: '2026-10-05' }),
    );
    expect(active.reasons).toEqual([R.ACTIVE_TEMPORARY_UNFITNESS]);
    expect(active.nextEligibilityDate).toBe('2026-10-06');
  });

  it('o encerramento antecipado decide a próxima data', () => {
    const r = run(
      {},
      createTestUnfitness({
        startDate: '2026-09-01',
        expectedEndDate: '2026-12-01',
        actualEndDate: '2026-10-03',
      }),
    );
    // Encerrada em 03/10: o doador já pode doar nesse dia.
    expect(r.nextEligibilityDate).toBe('2026-10-03');
  });

  it('inaptidão em aberto: não há próxima data', () => {
    expect(
      run({}, createTestUnfitness({ startDate: '2026-09-01' })).nextEligibilityDate,
    ).toBeNull();
  });

  it('acumula motivos e informa como próxima data a mais distante', () => {
    const r = run(
      { lastDonationAt: '2026-09-02', donationDates: ['2026-09-02'] },
      createTestUnfitness({ startDate: '2026-09-20', expectedEndDate: '2026-10-10' }),
    );
    expect(r.reasons).toEqual([R.ACTIVE_TEMPORARY_UNFITNESS, R.MIN_INTERVAL_NOT_FULFILLED]);
    expect(r.nextEligibilityDate).toBe('2026-11-02');
  });

  it.each([
    ['peso abaixo do mínimo', { weightKg: 45 }],
    ['menor sem o termo', { birthDate: '2009-05-01' }],
    ['60 anos sem doação antes', { birthDate: '1965-01-01', lastDonationAt: '2026-09-02' }],
  ])('com um motivo sem prazo (%s), não promete próxima data', (_d, overrides) => {
    const r = run({ lastDonationAt: '2026-09-02', donationDates: ['2026-09-02'], ...overrides });
    expect(r.reasons).toContain(R.MIN_INTERVAL_NOT_FULFILLED);
    expect(r.nextEligibilityDate).toBeNull();
  });
});
