import { NotificationJobType, Sex } from '@shared/domain/enums';
import type { EligibleAgainJobPayload } from '@shared/application/messaging';
import { NotifyEligibleAgainUseCase } from '@src/application/use-cases/notify-eligible-again.use-case';
import { EligibleAgainJob } from '@src/infrastructure/jobs/eligible-again.job';
import { createTestDonor, createTestUnfitness, dateWithOffset } from '@test/support/fixtures.fake';
import {
  FixedClock,
  InMemoryDonorRepository,
  InMemoryUnfitnessRepository,
  LoggerInMemory,
} from '@test/support/in-memory-repositories.fake';

// FIXED_NOW = 02/10/2026. Homem: intervalo de 2 meses -> quem doou em 02/08 volta a poder doar hoje.
const TODAY = dateWithOffset(0);

describe('NotifyEligibleAgainUseCase', () => {
  let donors: InMemoryDonorRepository;
  let unfitness: InMemoryUnfitnessRepository;
  let sent: EligibleAgainJobPayload[];
  let publisher: { enqueueEligibleAgain: jest.Mock };
  let logger: LoggerInMemory;
  let scheduling: { donorsWithOpenAppointment: jest.Mock };
  let useCase: NotifyEligibleAgainUseCase;

  beforeEach(() => {
    donors = new InMemoryDonorRepository();
    unfitness = new InMemoryUnfitnessRepository();
    sent = [];
    publisher = {
      enqueueEligibleAgain: jest.fn(async (p: EligibleAgainJobPayload) => void sent.push(p)),
    };
    logger = new LoggerInMemory();
    scheduling = { donorsWithOpenAppointment: jest.fn().mockResolvedValue([]) };
    useCase = new NotifyEligibleAgainUseCase(
      donors,
      unfitness,
      publisher,
      new FixedClock(),
      logger,
      scheduling,
    );
  });

  const donatedOn = (date: string, extra: Parameters<typeof createTestDonor>[0] = {}) =>
    createTestDonor({ lastDonationAt: date, donationDates: [date], sex: Sex.M, ...extra });

  it('avisa quem terminou o intervalo mínimo hoje', async () => {
    donors.seed(donatedOn('2026-08-02'));

    const result = await useCase.execute();

    expect(result).toEqual({ notified: 1, failed: 0 });
    expect(sent).toEqual([
      {
        type: NotificationJobType.ELIGIBLE_AGAIN,
        donorId: 'donor-1',
        donorName: 'Fulano de Tal',
        recipientEmail: 'fulano@example.com',
        eligibleSince: TODAY,
      },
    ]);
  });

  it('não avisa quem já podia doar antes nem quem ainda não pode', async () => {
    donors.seed(
      donatedOn('2026-07-01', { id: 'ja-podia' }),
      donatedOn('2026-08-20', { id: 'ainda-nao' }),
      createTestDonor({ id: 'nunca-doou' }),
    );

    await useCase.execute();

    expect(sent).toEqual([]);
  });

  it('avisa quem saiu hoje de uma inaptidão temporária (fim previsto ontem)', async () => {
    donors.seed(createTestDonor());
    unfitness.seed(
      createTestUnfitness({ startDate: dateWithOffset(-10), expectedEndDate: dateWithOffset(-1) }),
    );

    await useCase.execute();

    expect(sent.map((p) => p.donorId)).toEqual(['donor-1']);
  });

  it('não avisa se hoje há outro motivo (ex.: uma inaptidão nova), mesmo com o intervalo cumprido', async () => {
    donors.seed(donatedOn('2026-08-02'));
    unfitness.seed(createTestUnfitness({ startDate: TODAY }));

    await useCase.execute();

    expect(sent).toEqual([]);
  });

  it('respeita quem não aceita avisos e quem excluiu a conta', async () => {
    donors.seed(
      donatedOn('2026-08-02', { id: 'sem-avisos', receiveAlerts: false }),
      donatedOn('2026-08-02', { id: 'excluido', active: false }),
    );

    await useCase.execute();

    expect(sent).toEqual([]);
  });

  it('não avisa quem já tem agendamento em aberto (pergunta só pelos candidatos)', async () => {
    donors.seed(
      donatedOn('2026-08-02', { id: 'ja-agendou' }),
      donatedOn('2026-08-02', { id: 'sem-agendamento' }),
      donatedOn('2026-07-01', { id: 'nao-candidato' }),
    );
    scheduling.donorsWithOpenAppointment.mockResolvedValue(['ja-agendou']);

    await useCase.execute();

    expect(scheduling.donorsWithOpenAppointment).toHaveBeenCalledWith([
      'ja-agendou',
      'sem-agendamento',
    ]);
    expect(sent.map((p) => p.donorId)).toEqual(['sem-agendamento']);
  });

  it('se o scheduling não responder, a rodada falha (e é refeita no próximo ciclo)', async () => {
    donors.seed(donatedOn('2026-08-02'));
    scheduling.donorsWithOpenAppointment.mockRejectedValue(new Error('scheduling fora'));

    await expect(useCase.execute()).rejects.toThrow('scheduling fora');
    expect(sent).toEqual([]);
  });

  it('falha ao enfileirar: conta, registra o erro e segue para os outros', async () => {
    donors.seed(donatedOn('2026-08-02', { id: 'a' }), donatedOn('2026-08-02', { id: 'b' }));
    publisher.enqueueEligibleAgain.mockRejectedValueOnce(new Error('Redis fora'));

    const result = await useCase.execute();

    expect(result).toEqual({ notified: 1, failed: 1 });
    expect(logger.errors[0]).toContain('Redis fora');
  });
});

describe('EligibleAgainJob', () => {
  const config = { get: () => 'true' } as never;
  // 02/10/2026 às 07:59 e às 08:00 em Brasília (UTC-3).
  const before8 = new Date('2026-10-02T10:59:00.000Z');
  const at8 = new Date('2026-10-02T11:00:00.000Z');

  it('roda uma vez por dia, só a partir das 8h de Brasília', async () => {
    const execute = jest.fn().mockResolvedValue({ notified: 0, failed: 0 });
    const job = new EligibleAgainJob({ execute } as never, config);

    await job.tick(before8);
    expect(execute).not.toHaveBeenCalled();

    await job.tick(at8);
    await job.tick(new Date(at8.getTime() + 60 * 60_000));
    expect(execute).toHaveBeenCalledTimes(1);

    await job.tick(new Date(at8.getTime() + 24 * 3_600_000));
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('com falhas, tenta de novo no próximo ciclo do mesmo dia', async () => {
    const execute = jest
      .fn()
      .mockResolvedValueOnce({ notified: 0, failed: 2 })
      .mockResolvedValueOnce({ notified: 2, failed: 0 });
    const job = new EligibleAgainJob({ execute } as never, config);

    await job.tick(at8);
    await job.tick(new Date(at8.getTime() + 15 * 60_000));
    await job.tick(new Date(at8.getTime() + 30 * 60_000));

    expect(execute).toHaveBeenCalledTimes(2);
  });
});
