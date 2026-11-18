import {
  toAssessmentResponse,
  toAuditResponse,
  toDataExportResponse,
  toDonorResponse,
  toUnfitnessResponse,
} from '@src/presentation/http/presenters/index';

const at = new Date('2026-10-02T12:00:00.000Z');
const keys = (o: object) => Object.keys(o).sort();

/** Fixa o contrato HTTP: mudar um campo da resposta exige mudar estes testes de propósito. */
describe('presenters do eligibility (contrato da API)', () => {
  const donor = {
    id: 'd1',
    userId: 'u1',
    completeName: 'Maria',
    cpf: '123',
    birthDate: '1995-04-12',
    sex: 'F',
    phone: '11999998888',
    email: 'm@example.com',
    weightKg: '60.5',
    bloodType: 'O+',
    lastDonationAt: null,
    donationDates: ['2026-09-01'],
    permanentUnfit: false,
    permanentUnfitnessReason: 'Hepatite B',
    active: true,
    createdAt: at,
    updatedAt: at,
    guardianName: null,
    guardianConsentDeclared: false,
    donatedBefore60: null,
    regularDonorDeclared: false,
    medicalClearanceAt: null,
    medicalClearanceValidUntil: null,
    healthDataConsentAt: new Date('2026-01-01T12:00:00.000Z'),
    receiveAlerts: true,
  };
  const assessment = {
    id: 'a1',
    donorId: 'd1',
    appointmentId: null,
    result: 'ELIGIBLE',
    reasons: ['X'],
    notices: [],
    nextEligibilityDate: null,
    origin: 'MANUAL',
    assessedAt: at,
  };
  const unfitness = {
    id: 'f1',
    donorId: 'd1',
    reason: 'gripe',
    category: 'CLINIC',
    startDate: '2026-10-01',
    expectedEndDate: null,
    actualEndDate: null,
    registeredBy: 'u9',
    createdAt: at,
  };

  it('Donor: só os campos do contrato, datas em ISO e peso numérico', () => {
    const response = toDonorResponse(donor as never);
    expect(keys(response)).toEqual(
      [
        'id',
        'userId',
        'completeName',
        'cpf',
        'birthDate',
        'sex',
        'phone',
        'email',
        'weightKg',
        'bloodType',
        'lastDonationAt',
        'donationDates',
        'permanentUnfit',
        'permanentUnfitnessReason',
        'active',
        'createdAt',
        'updatedAt',
        'guardianName',
        'guardianConsentDeclared',
        'donatedBefore60',
        'regularDonorDeclared',
        'medicalClearanceAt',
        'medicalClearanceValidUntil',
        'healthDataConsentAt',
        'consentTermVersion',
        'healthDataLegalBasis',
        'personalDataLegalBasis',
        'receiveAlerts',
      ].sort(),
    );
    expect(response.weightKg).toBe(60.5);
    expect(response.createdAt).toBe('2026-10-02T12:00:00.000Z');
    expect(response.donationDates).toEqual(['2026-09-01']);
  });

  it('Assessment: contrato fixo e cópia dos motivos', () => {
    const response = toAssessmentResponse(assessment as never);
    expect(keys(response)).toEqual(
      [
        'id',
        'donorId',
        'appointmentId',
        'result',
        'reasons',
        'notices',
        'nextEligibilityDate',
        'origin',
        'assessedAt',
      ].sort(),
    );
    expect(response.reasons).not.toBe(assessment.reasons);
    expect(response.assessedAt).toBe('2026-10-02T12:00:00.000Z');
  });

  it('Unfitness e Audit: contrato fixo', () => {
    expect(keys(toUnfitnessResponse(unfitness as never))).toEqual(
      [
        'id',
        'donorId',
        'reason',
        'category',
        'startDate',
        'expectedEndDate',
        'actualEndDate',
        'registeredBy',
        'createdAt',
      ].sort(),
    );
    const audit = {
      id: 'x',
      donorId: 'd1',
      userId: null,
      userRole: 'ADMIN',
      action: 'VIEW',
      createdAt: at,
      extra: 1,
    };
    expect(keys(toAuditResponse(audit as never))).toEqual(
      ['id', 'donorId', 'userId', 'userRole', 'action', 'createdAt'].sort(),
    );
  });

  it('Exportação: mapeia cada parte pelo próprio presenter', () => {
    const response = toDataExportResponse({
      donor,
      temporaryUnfitness: [unfitness],
      eligibilityAssessments: [assessment],
    } as never);
    expect(keys(response)).toEqual(['donor', 'eligibilityAssessments', 'temporaryUnfitness']);
    expect(response.donor.createdAt).toBe('2026-10-02T12:00:00.000Z');
    expect(response.temporaryUnfitness[0].createdAt).toBe('2026-10-02T12:00:00.000Z');
    expect(response.eligibilityAssessments[0].assessedAt).toBe('2026-10-02T12:00:00.000Z');
  });
});
