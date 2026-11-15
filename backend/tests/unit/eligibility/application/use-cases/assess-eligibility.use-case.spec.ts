import { AccessDeniedError } from '@shared/application/errors';
import { AssessmentSource, EligibilityResult, Role, Sex } from '@shared/domain/enums';
import { NotFoundError } from '@src/application/errors/application.errors';
import { AssessEligibilityUseCase } from '@src/application/use-cases/assess-eligibility.use-case';
import { EligibilityHistoryUseCase } from '@src/application/use-cases/eligibility-history.use-case';
import {
  InMemoryAssessmentRepository,
  InMemoryDonorRepository,
  InMemoryUnfitnessRepository,
  FixedClock,
  buildAuditTrail,
} from '@test/support/in-memory-repositories.fake';
import { createTestDonor, createTestUnfitness, dateWithOffset } from '@test/support/fixtures.fake';
import { addMonths } from '@src/domain/services/dates';

const admin = { sub: 'admin-1', email: 'a@x.com', role: Role.ADMIN };

describe('AssessEligibilityUseCase', () => {
  let donors: InMemoryDonorRepository;
  let unfitness: InMemoryUnfitnessRepository;
  let assessments: InMemoryAssessmentRepository;
  let useCase: AssessEligibilityUseCase;

  const query = { donorId: 'donor-1', origin: AssessmentSource.DONOR_QUERY };

  beforeEach(() => {
    donors = new InMemoryDonorRepository();
    unfitness = new InMemoryUnfitnessRepository();
    assessments = new InMemoryAssessmentRepository();
    useCase = new AssessEligibilityUseCase(donors, unfitness, assessments, new FixedClock());
  });

  it.each([AssessmentSource.POST_DONATION, AssessmentSource.APPOINTMENT_VALIDATION])(
    'a origem %s é recusada pelo endpoint público, mesmo para admin',
    async (origin) => {
      donors.seed(createTestDonor());
      await expect(useCase.executeAs({ donorId: 'donor-1', origin }, admin)).rejects.toBeInstanceOf(
        AccessDeniedError,
      );
      expect(assessments.items).toHaveLength(0);
    },
  );

  it('a consulta pública responde sem gravar e ignora agendamento e dia da doação informados', async () => {
    donors.seed(createTestDonor());
    const result = await useCase.executeAs(
      { ...query, appointmentId: 'appointment-x', donationDate: '2030-01-01' },
      admin,
    );
    expect(result.result).toBe(EligibilityResult.ELIGIBLE);
    expect(result).not.toHaveProperty('appointmentId');
    expect(result).not.toHaveProperty('id');
    expect(assessments.items).toHaveLength(0);
  });

  it('a consulta pública aponta a próxima data quando o doador ainda não pode doar', async () => {
    donors.seed(createTestDonor({ lastDonationAt: dateWithOffset(-10) }));
    const result = await useCase.executeAs(query, admin);
    expect(result.result).not.toBe(EligibilityResult.ELIGIBLE);
    expect(result.nextEligibilityDate).not.toBeNull();
    expect(assessments.items).toHaveLength(0);
  });

  it('lança NotFoundError quando o doador não existe', async () => {
    await expect(
      useCase.execute({ donorId: 'inexistente', origin: AssessmentSource.DONOR_QUERY }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(assessments.items).toHaveLength(0);
  });

  it('retorna ELIGIBLE quando não há nenhum motivo de inelegibilidade e registra a avaliação', async () => {
    donors.seed(createTestDonor());
    const result = await useCase.execute({ ...query, appointmentId: 'appointment-1' });
    expect(result.result).toBe(EligibilityResult.ELIGIBLE);
    expect(result.reasons).toHaveLength(0);
    expect(result.nextEligibilityDate).toBeNull();
    expect(result.appointmentId).toBe('appointment-1');
    expect(assessments.items).toHaveLength(1);
  });

  it('guarda appointmentId nulo quando não informado', async () => {
    donors.seed(createTestDonor());
    expect((await useCase.execute(query)).appointmentId).toBeNull();
  });

  it('retorna PERMANENT_UNFIT quando o doador está marcado como inapto permanente', async () => {
    donors.seed(createTestDonor({ permanentUnfit: true }));
    const result = await useCase.execute(query);
    expect(result.result).toBe(EligibilityResult.PERMANENT_UNFIT);
    expect(result.reasons).toContain('PERMANENT_UNFIT');
  });

  it('aplica o intervalo de 2 meses para doadores do sexo masculino', async () => {
    donors.seed(createTestDonor({ sex: Sex.M, lastDonationAt: dateWithOffset(-30) }));
    const result = await useCase.execute(query);
    expect(result.result).toBe(EligibilityResult.TEMPORARY_UNFIT);
    expect(result.reasons).toContain('MIN_INTERVAL_NOT_FULFILLED');
    expect(result.nextEligibilityDate).toBe(addMonths(dateWithOffset(-30), 2));
  });

  it('aplica o intervalo de 3 meses para doadoras do sexo feminino', async () => {
    donors.seed(createTestDonor({ sex: Sex.F, lastDonationAt: dateWithOffset(-60) }));
    const result = await useCase.execute(query);
    expect(result.result).toBe(EligibilityResult.TEMPORARY_UNFIT);
    expect(result.reasons).toContain('MIN_INTERVAL_NOT_FULFILLED');
    expect(result.nextEligibilityDate).toBe(addMonths(dateWithOffset(-60), 3));
  });

  it('libera o doador quando o intervalo mínimo já foi cumprido', async () => {
    donors.seed(createTestDonor({ sex: Sex.M, lastDonationAt: dateWithOffset(-62) }));
    expect((await useCase.execute(query)).result).toBe(EligibilityResult.ELIGIBLE);
  });

  it('marca TEMPORARY_UNFIT por peso abaixo do mínimo', async () => {
    donors.seed(createTestDonor({ weightKg: 45 }));
    const result = await useCase.execute(query);
    expect(result.result).toBe(EligibilityResult.TEMPORARY_UNFIT);
    expect(result.reasons).toContain('INSUFFICIENT_WEIGHT');
  });

  it('marca motivo por idade abaixo da mínima', async () => {
    donors.seed(createTestDonor({ birthDate: dateWithOffset(-15 * 365) }));
    expect((await useCase.execute(query)).reasons).toContain('AGE_BELOW_MIN');
  });

  it('marca motivo por idade acima da máxima', async () => {
    donors.seed(createTestDonor({ birthDate: dateWithOffset(-75 * 365) }));
    expect((await useCase.execute(query)).reasons).toContain('AGE_ABOVE_MAX');
  });

  it('considera a inaptidão temporária ativa do doador', async () => {
    donors.seed(createTestDonor());
    unfitness.seed(createTestUnfitness({ expectedEndDate: dateWithOffset(10) }));

    const result = await useCase.execute(query);

    expect(result.result).toBe(EligibilityResult.TEMPORARY_UNFIT);
    expect(result.reasons).toContain('ACTIVE_TEMPORARY_UNFITNESS');
    // A inaptidão vale até o dia previsto (inclusive): o doador volta no dia seguinte.
    expect(result.nextEligibilityDate).toBe(dateWithOffset(11));
  });

  describe('agendamento: inaptidão no dia da doação', () => {
    const booking = (donationDate: string) => ({
      donorId: 'donor-1',
      origin: AssessmentSource.APPOINTMENT_VALIDATION,
      appointmentId: 'appointment-1',
      donationDate,
    });

    it('aceita doar depois do fim de uma inaptidão em vigor hoje', async () => {
      donors.seed(createTestDonor());
      unfitness.seed(createTestUnfitness({ expectedEndDate: dateWithOffset(10) }));

      expect((await useCase.execute(booking(dateWithOffset(11)))).result).toBe(
        EligibilityResult.ELIGIBLE,
      );
      expect((await useCase.execute(booking(dateWithOffset(10)))).result).toBe(
        EligibilityResult.TEMPORARY_UNFIT,
      );
    });

    it('recusa doar durante uma inaptidão que ainda vai começar', async () => {
      donors.seed(createTestDonor());
      unfitness.seed(
        createTestUnfitness({ startDate: dateWithOffset(5), expectedEndDate: dateWithOffset(20) }),
      );

      expect((await useCase.execute(booking(dateWithOffset(7)))).reasons).toContain(
        'ACTIVE_TEMPORARY_UNFITNESS',
      );
    });
  });

  it('a avaliação pós-doação é uma por agendamento (o outbox pode repetir o evento)', async () => {
    donors.seed(createTestDonor());
    const postDonation = {
      donorId: 'donor-1',
      origin: AssessmentSource.POST_DONATION,
      appointmentId: 'appointment-1',
    };

    const first = await useCase.execute(postDonation);
    const again = await useCase.execute(postDonation);

    expect(again.id).toBe(first.id);
    expect(assessments.items).toHaveLength(1);
  });

  it('ignora inaptidão temporária já encerrada', async () => {
    donors.seed(createTestDonor());
    unfitness.seed(
      createTestUnfitness({
        expectedEndDate: dateWithOffset(10),
        actualEndDate: dateWithOffset(-1),
      }),
    );
    expect((await useCase.execute(query)).result).toBe(EligibilityResult.ELIGIBLE);
  });

  describe('EligibilityHistoryUseCase', () => {
    const history = (audit = buildAuditTrail()) =>
      new EligibilityHistoryUseCase(donors, assessments, audit.trail);

    it('devolve as avaliações do doador e registra a leitura na auditoria', async () => {
      donors.seed(createTestDonor());
      await useCase.execute(query);
      await useCase.execute(query);
      const audit = buildAuditTrail();
      expect(await history(audit).execute('donor-1', admin)).toHaveLength(2);
      expect(audit.accesses.items.map((a) => a.action)).toEqual(['VIEW']);
    });

    it('doador inexistente: NotFoundError', async () => {
      await expect(history().execute('other', admin)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('doador não lê o histórico, nem o próprio', async () => {
      donors.seed(createTestDonor());
      const owner = { sub: 'user-1', email: 'x@x.com', role: Role.DONOR, donorId: 'donor-1' };
      await expect(history().execute('donor-1', owner)).rejects.toBeInstanceOf(AccessDeniedError);
    });
  });
});
