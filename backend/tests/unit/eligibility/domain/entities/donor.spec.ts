import { CONSENT_TERM_VERSION, LegalBasis } from '@shared/domain/consent/consent-term';
import { Sex, BloodType } from '@shared/domain/enums';
import { FIXED_NOW, createTestDonor } from '@test/support/fixtures.fake';
import { Donor, TEXT_ANONYMIZED } from '@src/domain/entities/donor';
import { BusinessRuleError, InvalidValueError } from '@src/domain/errors';

describe('Donor', () => {
  it('novo cadastro nasce ativo, sem doação, sem tipo sanguíneo e com o consentimento registrado', () => {
    const draft = Donor.draft(
      {
        userId: 'u',
        completeName: 'Fulano',
        cpf: '12345678901',
        birthDate: '1990-01-01',
        sex: Sex.F,
        email: 'f@example.com',
        weightKg: 60,
        healthDataConsent: true,
      },
      FIXED_NOW,
    );
    expect(draft).toMatchObject({
      active: true,
      permanentUnfit: false,
      bloodType: null,
      healthDataConsentAt: FIXED_NOW,
      consentTermVersion: CONSENT_TERM_VERSION,
      healthDataLegalBasis: LegalBasis.HEALTH_DATA_CONSENT,
      personalDataLegalBasis: LegalBasis.PERSONAL_DATA_CONSENT,
      lastDonationAt: null,
      donationDates: [],
      permanentUnfitnessReason: null,
    });
  });

  it('novo cadastro exige o consentimento para os dados de saúde (LGPD)', () => {
    const data = {
      userId: 'u',
      completeName: 'Fulano',
      cpf: '12345678901',
      birthDate: '1990-01-01',
      sex: Sex.F,
      email: 'f@example.com',
      weightKg: 60,
    };
    expect(() => Donor.draft(data, FIXED_NOW)).toThrow(/dados de saúde/);
    expect(() => Donor.draft({ ...data, healthDataConsent: false }, FIXED_NOW)).toThrow(
      InvalidValueError,
    );
  });

  it('novo cadastro grava a versão do termo e a base legal de cada categoria de dado (LGPD)', () => {
    const data = {
      userId: 'u',
      completeName: 'Fulano',
      cpf: '12345678901',
      birthDate: '1990-01-01',
      sex: Sex.F,
      email: 'f@example.com',
      weightKg: 60,
      healthDataConsent: true,
    };
    const semVersao = Donor.draft(data, FIXED_NOW);
    expect(semVersao.consentTermVersion).toBe(CONSENT_TERM_VERSION);
    expect(semVersao.healthDataLegalBasis).toBe('LGPD_ART_11_I');
    expect(semVersao.personalDataLegalBasis).toBe('LGPD_ART_7_I');
    const comVersao = Donor.draft({ ...data, consentTermVersion: CONSENT_TERM_VERSION }, FIXED_NOW);
    expect(comVersao.consentTermVersion).toBe(CONSENT_TERM_VERSION);
  });

  it('novo cadastro recusa um termo de consentimento de outra versão', () => {
    const data = {
      userId: 'u',
      completeName: 'Fulano',
      cpf: '12345678901',
      birthDate: '1990-01-01',
      sex: Sex.F,
      email: 'f@example.com',
      weightKg: 60,
      healthDataConsent: true,
      consentTermVersion: '2020-01-01',
    };
    expect(() => Donor.draft(data, FIXED_NOW)).toThrow(/termo de consentimento mudou/);
    expect(() => Donor.draft(data, FIXED_NOW)).toThrow(InvalidValueError);
  });

  it('novo cadastro rejeita CPF ou e-mail inválidos', () => {
    const base = {
      userId: 'u',
      completeName: 'Fulano',
      cpf: '12345678901',
      birthDate: '1990-01-01',
      sex: Sex.F,
      email: 'f@example.com',
      weightKg: 60,
      healthDataConsent: true,
    };
    expect(() => Donor.draft({ ...base, cpf: '123.456.789-01' }, FIXED_NOW)).toThrow(
      InvalidValueError,
    );
    expect(() => Donor.draft({ ...base, email: 'sem-arroba' }, FIXED_NOW)).toThrow(
      InvalidValueError,
    );
  });

  describe('updateProfile', () => {
    it('altera só o que foi informado', () => {
      const donor = createTestDonor({ phone: '111' });
      donor.updateProfile({ bloodType: BloodType.O_NEGATIVE }, FIXED_NOW);
      expect(donor.bloodType).toBe(BloodType.O_NEGATIVE);
      expect(donor.phone).toBe('111');
    });

    it('corrige CPF, nascimento, sexo e peso', () => {
      const donor = createTestDonor();
      donor.updateProfile(
        { cpf: '52998224725', birthDate: '1991-03-04', sex: Sex.F, weightKg: 58 },
        FIXED_NOW,
      );
      expect(donor).toMatchObject({
        cpf: '52998224725',
        birthDate: '1991-03-04',
        sex: Sex.F,
        weightKg: 58,
      });
    });

    it('telefone vazio ou null apaga o telefone', () => {
      const donor = createTestDonor({ phone: '11999998888' });
      donor.updateProfile({ phone: '  ' }, FIXED_NOW);
      expect(donor.phone).toBeNull();
      donor.updateProfile({ phone: '11988887777' }, FIXED_NOW);
      donor.updateProfile({ phone: null }, FIXED_NOW);
      expect(donor.phone).toBeNull();
    });

    it('recusa CPF, nascimento ou peso inválidos sem mudar nada', () => {
      const donor = createTestDonor();
      expect(() => donor.updateProfile({ cpf: '123', sex: Sex.F }, FIXED_NOW)).toThrow(
        InvalidValueError,
      );
      expect(() => donor.updateProfile({ birthDate: '2999-01-01' }, FIXED_NOW)).toThrow(/futuro/);
      expect(() => donor.updateProfile({ birthDate: '1890-01-01' }, FIXED_NOW)).toThrow(/ano/);
      expect(() => donor.updateProfile({ weightKg: 0 }, FIXED_NOW)).toThrow(/peso/);
      expect(donor.sex).toBe(Sex.M);
    });

    it('a última doação informada avança a data e entra no histórico', () => {
      const donor = createTestDonor({
        lastDonationAt: '2026-05-01',
        donationDates: ['2026-05-01'],
      });
      donor.updateProfile({ lastDonationDate: '2026-08-10' }, FIXED_NOW);
      expect(donor.lastDonationAt).toBe('2026-08-10');
      expect(donor.donationDates).toEqual(['2026-05-01', '2026-08-10']);
    });

    it('a última doação não recua, não fica no futuro nem antes do nascimento', () => {
      const donor = createTestDonor({
        lastDonationAt: '2026-05-01',
        donationDates: ['2026-05-01'],
      });
      expect(() => donor.updateProfile({ lastDonationDate: '2026-04-01' }, FIXED_NOW)).toThrow(
        BusinessRuleError,
      );
      expect(() => donor.updateProfile({ lastDonationDate: '2026-12-01' }, FIXED_NOW)).toThrow();
      expect(() => donor.updateProfile({ birthDate: '2026-06-01' }, FIXED_NOW)).toThrow(
        /anterior ao nascimento/,
      );
      expect(donor.lastDonationAt).toBe('2026-05-01');
    });

    it('outra data de nascimento desfaz a avaliação médica', () => {
      const donor = createTestDonor({
        birthDate: '1950-01-01',
        regularDonorDeclared: true,
        medicalClearanceAt: '2026-09-01',
        medicalClearanceBy: 'admin-1',
      });
      donor.updateProfile({ birthDate: '1951-01-01' }, FIXED_NOW);
      expect(donor.medicalClearanceAt).toBeNull();
      expect(donor.medicalClearanceBy).toBeNull();
    });
  });

  describe('updateIdentity', () => {
    it('troca nome e e-mail', () => {
      const donor = createTestDonor();
      donor.updateIdentity({ completeName: '  Fulana de Tal ', email: 'fulana@example.com' });
      expect(donor.completeName).toBe('Fulana de Tal');
      expect(donor.email).toBe('fulana@example.com');
    });

    it('recusa nome curto ou e-mail inválido', () => {
      const donor = createTestDonor();
      expect(() => donor.updateIdentity({ completeName: 'Al' })).toThrow(InvalidValueError);
      expect(() => donor.updateIdentity({ email: 'sem-arroba' })).toThrow(InvalidValueError);
    });
  });

  it('registerDonationCompleted informa se houve alteração', () => {
    const donor = createTestDonor({ lastDonationAt: '2026-09-20', donationDates: ['2026-09-20'] });
    expect(donor.registerDonationCompleted('2026-09-20', '2026-10-02')).toBe(false);
    expect(donor.registerDonationCompleted(undefined, '2026-10-02')).toBe(true);
    expect(donor.lastDonationAt).toBe('2026-10-02');
  });

  it('doação mais antiga registrada depois de uma mais recente entra no histórico, sem recuar a última', () => {
    const donor = createTestDonor({ lastDonationAt: '2026-09-01', donationDates: ['2026-09-01'] });

    expect(donor.registerDonationCompleted('2026-07-01', '2026-10-30')).toBe(true);

    expect(donor.lastDonationAt).toBe('2026-09-01');
    expect(donor.donationDates).toEqual(['2026-07-01', '2026-09-01']);
    // repetir o mesmo evento (retry do outbox) não muda nada
    expect(donor.registerDonationCompleted('2026-07-01', '2026-10-30')).toBe(false);
  });

  it('doação de mais de 12 meses atrás não entra no histórico do limite anual', () => {
    const donor = createTestDonor({ lastDonationAt: '2026-09-01', donationDates: ['2026-09-01'] });
    expect(donor.registerDonationCompleted('2025-09-01', '2026-10-30')).toBe(false);
    expect(donor.donationDates).toEqual(['2026-09-01']);
  });

  it('registerDonationCompleted mantém o histórico dos últimos 12 meses, sem duplicar datas', () => {
    const donor = createTestDonor({
      lastDonationAt: '2026-03-10',
      donationDates: ['2025-10-03', '2026-03-10'],
    });
    expect(donor.registerDonationCompleted('2026-03-10', '2026-10-02')).toBe(false);
    expect(donor.donationDates).toEqual(['2025-10-03', '2026-03-10']);
    donor.registerDonationCompleted('2026-09-30', '2026-10-02');
    expect(donor.lastDonationAt).toBe('2026-09-30');
    expect(donor.donationDates).toEqual(['2025-10-03', '2026-03-10', '2026-09-30']);
    donor.registerDonationCompleted('2026-10-02', '2026-10-04');
    expect(donor.donationDates).toEqual(['2026-03-10', '2026-09-30', '2026-10-02']);
  });

  it('anonimizar descaracteriza os dados identificantes e é determinístico no CPF', () => {
    const a = createTestDonor({ permanentUnfitnessReason: 'secret' });
    const b = createTestDonor({ permanentUnfitnessReason: 'secret' });
    a.anonymize();
    b.anonymize();
    expect(a.cpf).toBe(b.cpf);
    expect(a.cpf).toMatch(/^[0-9a-f]{11}$/);
    expect(a.permanentUnfitnessReason).toBe(TEXT_ANONYMIZED);
    expect(a.active).toBe(false);
    expect(a.email).toBe('anon-donor-1@anonymized.local');
  });
});
