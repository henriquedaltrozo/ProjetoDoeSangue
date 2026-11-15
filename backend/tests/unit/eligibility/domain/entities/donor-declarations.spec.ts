import { Sex } from '@shared/domain/enums';
import { Donor } from '@src/domain/entities/donor';
import { BusinessRuleError, InvalidValueError } from '@src/domain/errors';
import { FIXED_NOW, createTestDonor } from '@test/support/fixtures.fake';

/** "Hoje" é 2026-10-02 (FIXED_NOW). */
const base = {
  userId: 'u',
  completeName: 'Fulano de Tal',
  cpf: '12345678901',
  sex: Sex.F,
  email: 'f@example.com',
  weightKg: 60,
  healthDataConsent: true,
};
const draft = (data: Partial<Parameters<typeof Donor.draft>[0]>) =>
  Donor.draft({ ...base, birthDate: '1990-01-01', ...data }, FIXED_NOW);

describe('Donor - declarações no cadastro', () => {
  it('menor de 18 precisa informar o responsável e confirmar o termo', () => {
    expect(() => draft({ birthDate: '2009-05-01' })).toThrow(InvalidValueError);
    expect(() => draft({ birthDate: '2009-05-01', guardianName: 'Maria' })).toThrow(
      InvalidValueError,
    );
    expect(
      draft({ birthDate: '2009-05-01', guardianName: '  Maria  ', guardianConsent: true }),
    ).toMatchObject({ guardianName: 'Maria', guardianConsentDeclared: true });
  });

  it('com 60 anos ou mais, precisa responder se doou antes dos 60 (sim ou não)', () => {
    expect(() => draft({ birthDate: '1965-01-01' })).toThrow(/antes dos 60/);
    expect(draft({ birthDate: '1965-01-01', donatedBefore60: false })).toMatchObject({
      donatedBefore60: false,
    });
  });

  it('com 70 anos ou mais, precisa responder também se é doador regular', () => {
    expect(() => draft({ birthDate: '1950-01-01', donatedBefore60: true })).toThrow(
      /doador voluntário regular/,
    );
    expect(
      draft({ birthDate: '1950-01-01', donatedBefore60: true, regularDonor: true }),
    ).toMatchObject({ regularDonorDeclared: true, medicalClearanceAt: null });
  });

  it('adulto entre 18 e 59 anos não precisa declarar nada', () => {
    expect(draft({})).toMatchObject({
      guardianName: null,
      guardianConsentDeclared: false,
      donatedBefore60: null,
      regularDonorDeclared: false,
    });
  });

  it('a última doação informada vira a última doação e entra no histórico se for dos últimos 12 meses', () => {
    expect(draft({ lastDonationDate: '2026-06-10' })).toMatchObject({
      lastDonationAt: '2026-06-10',
      donationDates: ['2026-06-10'],
    });
    expect(draft({ lastDonationDate: '2024-06-10' })).toMatchObject({
      lastDonationAt: '2024-06-10',
      donationDates: [],
    });
  });

  it('uma última doação anterior aos 60 responde "doou antes dos 60", e uma posterior não', () => {
    expect(
      draft({ birthDate: '1962-01-01', donatedBefore60: false, lastDonationDate: '2020-05-01' }),
    ).toMatchObject({ donatedBefore60: true });
    expect(
      draft({ birthDate: '1962-01-01', donatedBefore60: false, lastDonationDate: '2025-06-10' }),
    ).toMatchObject({ donatedBefore60: false });
  });

  it('recusa data de nascimento no futuro ou de mais de 120 anos', () => {
    expect(() => draft({ birthDate: '2026-10-03' })).toThrow(/futuro/);
    expect(() => draft({ birthDate: '1900-01-01' })).toThrow(/confira o ano/);
  });

  it('recusa última doação no futuro ou antes do nascimento', () => {
    expect(() => draft({ lastDonationDate: '2026-12-01' })).toThrow(InvalidValueError);
    expect(() => draft({ lastDonationDate: '1989-01-01' })).toThrow(/nascimento/);
  });
});

describe('Donor - correção das declarações e avaliação médica', () => {
  it('o doador corrige o que declarou', () => {
    const donor = createTestDonor({ birthDate: '1962-01-01' });
    donor.updateDeclarations({ donatedBefore60: true });
    expect(donor.donatedBefore60).toBe(true);
  });

  it('confirmar o termo exige o nome do responsável', () => {
    expect(() => createTestDonor().updateDeclarations({ guardianConsent: true })).toThrow(
      InvalidValueError,
    );
  });

  it('uma doação registrada antes dos 60 fica guardada como "doou antes dos 60"', () => {
    const young = createTestDonor({ birthDate: '1967-01-01' });
    young.registerDonationCompleted('2026-09-01', '2026-10-02');
    expect(young.donatedBefore60).toBe(true);

    const older = createTestDonor({ birthDate: '1960-01-01', donatedBefore60: null });
    older.registerDonationCompleted('2026-09-01', '2026-10-02');
    expect(older.donatedBefore60).toBeNull();
  });

  it('a avaliação médica só pode ser registrada a partir dos 70 anos', () => {
    const donor = createTestDonor({ birthDate: '1957-01-01', regularDonorDeclared: true });
    expect(() => donor.registerMedicalClearance('admin-1', FIXED_NOW)).toThrow(/70 anos/);
  });

  it('a avaliação médica só pode ser registrada para quem declarou ser doador regular', () => {
    const donor = createTestDonor({ birthDate: '1950-01-01' });
    expect(() => donor.registerMedicalClearance('admin-1', FIXED_NOW)).toThrow(BusinessRuleError);
    donor.updateDeclarations({ regularDonor: true });
    donor.registerMedicalClearance('admin-1', FIXED_NOW);
    expect(donor).toMatchObject({
      medicalClearanceAt: '2026-10-02',
      medicalClearanceBy: 'admin-1',
    });
  });

  it('deixar de se declarar regular desfaz a avaliação médica', () => {
    const donor = createTestDonor({
      regularDonorDeclared: true,
      medicalClearanceAt: '2026-09-01',
      medicalClearanceBy: 'admin-1',
    });
    donor.updateDeclarations({ regularDonor: false });
    expect(donor).toMatchObject({ medicalClearanceAt: null, medicalClearanceBy: null });
  });

  it('a anonimização apaga o nome do responsável legal', () => {
    const donor = createTestDonor({ guardianName: 'Maria', guardianConsentDeclared: true });
    donor.anonymize();
    expect(donor.guardianName).toBeNull();
  });
});
