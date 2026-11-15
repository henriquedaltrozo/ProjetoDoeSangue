import { AssessmentNotice, AssessmentSource, EligibilityResult } from '@shared/domain/enums';
import { toBusinessDate } from '@shared/domain/time';
import { AppointmentStatus } from '@src/domain/enums';
import { OutboxEventType } from '@src/domain/outbox';
import { BusinessRuleError, InvalidValueError } from '@src/domain/errors';
import { AccessDeniedError, NotFoundError } from '@src/application/errors';
import { AppointmentsEnvironment, buildAppointmentsEnvironment } from '@test/support/environment';
import { admin, donor, hoursFromNow, oneCampaign, oneUnit } from '@test/support/builders';

const eligible = {
  id: 'assessment-1',
  result: EligibilityResult.ELIGIBLE,
  reasons: [],
  nextEligibilityDate: null,
  notices: [],
};

describe('CreateAppointmentUseCase', () => {
  let environment: AppointmentsEnvironment;
  const command = (partial: Record<string, unknown> = {}) => ({
    donorId: 'donor-1',
    collectionUnitId: 'unit-1',
    dateTime: hoursFromNow(24).toISOString(),
    ...partial,
  });

  beforeEach(() => {
    environment = buildAppointmentsEnvironment();
    environment.units.add(oneUnit({ simultaneousCapacity: 2 }));
  });

  it('impede um doador de agendar em nome de outro doador', async () => {
    const find = jest.spyOn(environment.units, 'findById');

    await expect(environment.create.execute(command(), donor('other-donor'))).rejects.toThrow(
      new AccessDeniedError('Você só pode agendar para si mesmo.'),
    );
    expect(find).not.toHaveBeenCalled();
  });

  it('doador sem o e-mail confirmado não agenda; admin agenda por ele', async () => {
    environment.eligibility.assessInternal.mockResolvedValue(eligible);

    await expect(
      environment.create.execute(command(), { ...donor('donor-1'), emailVerified: false }),
    ).rejects.toThrow(/Confirme seu e-mail/);
    await expect(environment.create.execute(command(), admin())).resolves.toMatchObject({
      donorId: 'donor-1',
    });
  });

  it('rejeita dateTime no passado', async () => {
    await expect(
      environment.create.execute(
        command({ dateTime: '2000-01-01T10:00:00.000Z' }),
        donor('donor-1'),
      ),
    ).rejects.toBeInstanceOf(InvalidValueError);
  });

  it('rejeita dateTime que não é uma data', async () => {
    await expect(
      environment.create.execute(command({ dateTime: 'ontem' }), donor('donor-1')),
    ).rejects.toBeInstanceOf(InvalidValueError);
  });

  it('rejeita unidade inexistente e unidade inativa', async () => {
    await expect(
      environment.create.execute(command({ collectionUnitId: 'not-exists' }), donor('donor-1')),
    ).rejects.toThrow(new NotFoundError('Unidade de coleta não encontrada.'));

    environment.units.add(oneUnit({ id: 'unit-2', active: false }));
    await expect(
      environment.create.execute(command({ collectionUnitId: 'unit-2' }), donor('donor-1')),
    ).rejects.toThrow(new BusinessRuleError('Unidade de coleta inativa.'));
  });

  it('rejeita campanha inexistente e campanha inativa', async () => {
    await expect(
      environment.create.execute(command({ campaignId: 'not-exists' }), donor('donor-1')),
    ).rejects.toThrow(new NotFoundError('Campanha não encontrada.'));

    environment.campaigns.add(oneCampaign({ active: false }));
    await expect(
      environment.create.execute(command({ campaignId: 'campaign-1' }), donor('donor-1')),
    ).rejects.toThrow(new BusinessRuleError('Campanha inativa.'));
  });

  it('confirma o agendamento e agenda o lembrete quando a avaliação retorna ELIGIBLE', async () => {
    environment.eligibility.assessInternal.mockResolvedValue(eligible);

    const result = await environment.create.execute(command(), donor('donor-1'));

    expect(result.status).toBe(AppointmentStatus.ELIGIBILITY_CONFIRMED);
    expect(result.assessmentEligibilityId).toBe('assessment-1');
    expect(result.eligibilityAssessment).toEqual(eligible);
    expect(environment.eligibility.assessInternal).toHaveBeenCalledWith({
      donorId: 'donor-1',
      origin: AssessmentSource.APPOINTMENT_VALIDATION,
      appointmentId: result.id,
      donationDate: toBusinessDate(result.dateTime),
    });
    // Os e-mails do agendamento vão pelo outbox, na mesma transação do resultado da avaliação.
    const events = [...environment.outbox.events.values()];
    expect(events.map((e) => e.type)).toEqual([OutboxEventType.APPOINTMENT_CONFIRMED]);
    expect(events[0].payload).toEqual({ appointmentId: result.id });
    expect(environment.publisher.enqueueReminder24H).not.toHaveBeenCalled();
    expect(environment.appointments.appointments.get(result.id)?.status).toBe(
      AppointmentStatus.ELIGIBILITY_CONFIRMED,
    );
  });

  it('guarda os avisos da avaliação no agendamento (os e-mails os repetem)', async () => {
    environment.eligibility.assessInternal.mockResolvedValue({
      ...eligible,
      notices: [AssessmentNotice.BRING_GUARDIAN_CONSENT],
    });

    const result = await environment.create.execute(command(), donor('donor-1'));

    expect(result.eligibilityNotices).toEqual([AssessmentNotice.BRING_GUARDIAN_CONSENT]);
  });

  it('invalida o cache de disponibilidade do dia do agendamento', async () => {
    environment.eligibility.assessInternal.mockResolvedValue(eligible);
    const dateTime = hoursFromNow(24).toISOString();

    await environment.create.execute(command({ dateTime }), donor('donor-1'));

    expect(environment.cache.invalidations).toContain(`unit-1:${dateTime.slice(0, 10)}`);
  });

  it('marca ELIGIBILITY_DENIED e não agenda lembrete quando o doador não está apto', async () => {
    environment.eligibility.assessInternal.mockResolvedValue({
      id: 'assessment-1',
      result: EligibilityResult.TEMPORARY_UNFIT,
      reasons: ['MIN_INTERVAL_NOT_FULFILLED'],
      nextEligibilityDate: '2026-10-01',
    });

    const result = await environment.create.execute(command(), donor('donor-1'));

    expect(result.status).toBe(AppointmentStatus.ELIGIBILITY_DENIED);
    expect(environment.outbox.events.size).toBe(0);
  });

  describe('reserva de vaga', () => {
    it('checa vagas e reserva dentro de uma transação, com o horário travado', async () => {
      environment.eligibility.assessInternal.mockResolvedValue(eligible);

      await environment.create.execute(command(), donor('donor-1'));

      // 1ª transação: a reserva. 2ª (depois da avaliação): o resultado e o evento dos e-mails.
      expect(environment.unitOfWork.transactions).toBe(2);
      expect(environment.appointments.operationsInTransaction.slice(0, 5)).toEqual([
        'blockDonor',
        'countOpenByDonor',
        'blockTime',
        'countOccupied',
        'create',
      ]);
    });

    it('recusa um segundo agendamento em aberto do mesmo doador, sem avaliar', async () => {
      environment.eligibility.assessInternal.mockResolvedValue(eligible);
      await environment.create.execute(command(), donor('donor-1'));
      environment.eligibility.assessInternal.mockClear();

      await expect(
        environment.create.execute(
          command({ dateTime: hoursFromNow(72).toISOString() }),
          donor('donor-1'),
        ),
      ).rejects.toThrow(/agendamento em aberto/);
      expect(environment.eligibility.assessInternal).not.toHaveBeenCalled();
    });

    it('depois de cancelar, o doador pode agendar de novo', async () => {
      environment.eligibility.assessInternal.mockResolvedValue(eligible);
      const first = await environment.create.execute(command(), donor('donor-1'));
      await environment.cancel.execute(first.id, donor('donor-1'));

      await expect(
        environment.create.execute(
          command({ dateTime: hoursFromNow(72).toISOString() }),
          donor('donor-1'),
        ),
      ).resolves.toMatchObject({ status: AppointmentStatus.ELIGIBILITY_CONFIRMED });
    });

    it('rejeita quando não há vagas disponíveis no horário, sem avaliar nem gravar nada', async () => {
      environment.eligibility.assessInternal.mockResolvedValue(eligible);
      const dateTime = hoursFromNow(24).toISOString();
      await environment.create.execute(command({ dateTime, donorId: 'donor-1' }), admin());
      await environment.create.execute(command({ dateTime, donorId: 'donor-2' }), admin());
      environment.eligibility.assessInternal.mockClear();

      await expect(
        environment.create.execute(command({ dateTime, donorId: 'donor-3' }), admin()),
      ).rejects.toThrow(new BusinessRuleError('Não há vagas disponíveis neste horário.'));

      expect(environment.eligibility.assessInternal).not.toHaveBeenCalled();
      expect(environment.appointments.appointments.size).toBe(2);
    });

    it('agendamentos cancelados ou negados não ocupam vaga', async () => {
      environment.eligibility.assessInternal.mockResolvedValue(eligible);
      const dateTime = hoursFromNow(24).toISOString();
      const first = await environment.create.execute(
        command({ dateTime, donorId: 'donor-1' }),
        admin(),
      );
      await environment.create.execute(command({ dateTime, donorId: 'donor-2' }), admin());
      await environment.cancel.execute(first.id, admin());

      await expect(
        environment.create.execute(command({ dateTime, donorId: 'donor-3' }), admin()),
      ).resolves.toMatchObject({ status: AppointmentStatus.ELIGIBILITY_CONFIRMED });
    });

    it('horários diferentes têm vagas independentes', async () => {
      environment.units.add(oneUnit({ simultaneousCapacity: 1 }));
      environment.eligibility.assessInternal.mockResolvedValue(eligible);

      await environment.create.execute(
        command({ dateTime: hoursFromNow(24).toISOString(), donorId: 'donor-1' }),
        admin(),
      );

      await expect(
        environment.create.execute(
          command({ dateTime: hoursFromNow(25).toISOString(), donorId: 'donor-2' }),
          admin(),
        ),
      ).resolves.toBeDefined();
    });
  });

  it('desfaz a reserva se a chamada ao eligibility-service falhar', async () => {
    environment.eligibility.assessInternal.mockRejectedValue(new Error('serviço fora do ar'));

    await expect(environment.create.execute(command(), donor('donor-1'))).rejects.toThrow(
      'serviço fora do ar',
    );

    expect(environment.appointments.removed).toEqual(['appointment-1']);
    expect(environment.appointments.appointments.size).toBe(0);
    expect(environment.cache.invalidations).toHaveLength(1);
  });

  it('não desfaz um agendamento já avaliado se uma falha vier depois da avaliação', async () => {
    environment.eligibility.assessInternal.mockResolvedValue(eligible);
    jest
      .spyOn(environment.cache, 'invalidateDay')
      .mockRejectedValueOnce(new Error('redis fora do ar'));

    await expect(environment.create.execute(command(), donor('donor-1'))).rejects.toThrow(
      'redis fora do ar',
    );

    expect(environment.appointments.removed).toEqual([]);
    expect(environment.appointments.appointments.get('appointment-1')?.status).toBe(
      AppointmentStatus.ELIGIBILITY_CONFIRMED,
    );
  });

  it('com a fila fora do ar, o agendamento é criado e o evento dos e-mails fica no outbox', async () => {
    environment.eligibility.assessInternal.mockResolvedValue(eligible);
    environment.publisher.enqueueReminder24H.mockRejectedValue(new Error('redis fora do ar'));

    const result = await environment.create.execute(command(), donor('donor-1'));

    expect(result.status).toBe(AppointmentStatus.ELIGIBILITY_CONFIRMED);
    expect(environment.outbox.events.size).toBe(1);
  });
});
