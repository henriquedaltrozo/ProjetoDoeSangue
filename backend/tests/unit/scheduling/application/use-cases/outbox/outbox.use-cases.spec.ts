import { UnknownEventTypeError } from '@src/application/errors/application.errors';
import {
  OUTBOX_RECONCILIATION_WINDOW_DAYS,
  OUTBOX_BATCH,
  OUTBOX_LEASE_MS,
  OUTBOX_MAX_REPROCESSINGS,
  OUTBOX_MAX_ATTEMPTS,
  OutboxStatus,
  OutboxEventType,
} from '@src/domain/outbox';
import { NotFoundError } from '@src/application/errors';
import { NOW, oneOutboxEvent } from '@test/support/builders';
import {
  FakeClock,
  FakeCampaignRepository,
  FakeAppointmentRepository,
  FakeCollectionUnitRepository,
  FakeOutboxRepository,
  createEligibilityGateway,
  createLogger,
  createNotificationPublisher,
} from '@test/support/fakes';
import { DispatchOutboxUseCase } from '@src/application/use-cases/outbox/dispatch-outbox.use-case';
import { ListOutboxFailuresUseCase } from '@src/application/use-cases/outbox/list-outbox-failures.use-case';
import { ReconcileOutboxUseCase } from '@src/application/use-cases/outbox/reconcile-outbox.use-case';
import { ReprocessEventOutboxUseCase } from '@src/application/use-cases/outbox/reprocess-event-outbox.use-case';
import { AssessmentSource, BloodType } from '@shared/domain/enums';
import { hoursFromNow, oneAppointment, oneCampaign, oneUnit } from '@test/support/builders';
import { AppointmentStatus } from '@src/domain/enums';
import { AppointmentNotificationsService } from '@src/application/services/appointment-notifications.service';
import { NotificationJobType } from '@shared/domain/enums';

describe('DispatchOutboxUseCase', () => {
  let outbox: FakeOutboxRepository;
  let campaigns: FakeCampaignRepository;
  let eligibility: ReturnType<typeof createEligibilityGateway>;
  let publisher: ReturnType<typeof createNotificationPublisher>;
  let logger: ReturnType<typeof createLogger>;
  let clock: FakeClock;
  let units: FakeCollectionUnitRepository;
  let appointments: FakeAppointmentRepository;
  let dispatcher: DispatchOutboxUseCase;

  beforeEach(() => {
    units = new FakeCollectionUnitRepository();
    appointments = new FakeAppointmentRepository();
    outbox = new FakeOutboxRepository();
    campaigns = new FakeCampaignRepository();
    eligibility = createEligibilityGateway();
    publisher = createNotificationPublisher();
    logger = createLogger();
    clock = new FakeClock();
    dispatcher = new DispatchOutboxUseCase(
      outbox,
      campaigns,
      eligibility,
      publisher,
      clock,
      logger,
      units,
      appointments,
      new AppointmentNotificationsService(
        publisher,
        { buildUrl: () => 'http://front/confirm?token=t', verify: jest.fn() },
        clock,
        logger,
      ),
    );
  });

  describe('aviso de falta', () => {
    it('busca o contato e convida o doador a reagendar (jobId por agendamento)', async () => {
      units.add(oneUnit({ id: 'unit-z', name: 'Unidade Zona Sul' }));
      const event = oneOutboxEvent({
        type: OutboxEventType.APPOINTMENT_NO_SHOW,
        payload: {
          appointmentId: 'appointment-1',
          donorId: 'donor-1',
          collectionUnitId: 'unit-z',
          dateTime: '2026-10-10T13:00:00.000Z',
        },
      });

      await dispatcher.handle(event);

      expect(event.status).toBe(OutboxStatus.PROCESSED);
      expect(publisher.enqueueNoShow).toHaveBeenCalledWith({
        type: NotificationJobType.NO_SHOW,
        appointmentId: 'appointment-1',
        donorId: 'donor-1',
        donorName: 'Fulano',
        recipientEmail: 'fulano@x.com',
        dateTime: '2026-10-10T13:00:00.000Z',
        collectionUnitName: 'Unidade Zona Sul',
      });
    });
  });

  describe('e-mails do agendamento confirmado', () => {
    const confirmedEvent = () =>
      oneOutboxEvent({
        type: OutboxEventType.APPOINTMENT_CONFIRMED,
        payload: { appointmentId: 'appointment-1' },
      });

    it('confere o agendamento, busca o contato e agenda confirmação, lembrete e pedido', async () => {
      appointments.appointments.set(
        'appointment-1',
        oneAppointment({ dateTime: hoursFromNow(100), collectionUnitId: 'unit-z' }),
      );
      units.add(oneUnit({ id: 'unit-z', name: 'Unidade Zona Sul' }));
      const event = confirmedEvent();

      await dispatcher.handle(event);

      expect(event.status).toBe(OutboxStatus.PROCESSED);
      expect(eligibility.findDonorContact).toHaveBeenCalledWith('donor-1');
      expect(publisher.enqueueAppointmentBooked).toHaveBeenCalledWith(
        expect.objectContaining({ collectionUnitName: 'Unidade Zona Sul', donorName: 'Fulano' }),
      );
      expect(publisher.enqueueReminder24H).toHaveBeenCalled();
      expect(publisher.enqueueAttendanceConfirmation).toHaveBeenCalled();
    });

    it('agendamento cancelado (ou com horário já passado) enquanto o evento esperava: não agenda nada', async () => {
      appointments.appointments.set(
        'appointment-1',
        oneAppointment({ status: AppointmentStatus.CANCELED, dateTime: hoursFromNow(100) }),
      );
      await dispatcher.handle(confirmedEvent());

      appointments.appointments.set(
        'appointment-1',
        oneAppointment({ dateTime: hoursFromNow(-1) }),
      );
      await dispatcher.handle(confirmedEvent());

      expect(publisher.enqueueAppointmentBooked).not.toHaveBeenCalled();
      expect(publisher.enqueueReminder24H).not.toHaveBeenCalled();
    });

    it('com a fila fora do ar, o evento é reagendado (os e-mails não se perdem)', async () => {
      appointments.appointments.set(
        'appointment-1',
        oneAppointment({ dateTime: hoursFromNow(100) }),
      );
      publisher.enqueueAppointmentBooked.mockRejectedValueOnce(new Error('redis fora do ar'));
      const event = confirmedEvent();

      await dispatcher.handle(event);

      expect(event.status).toBe(OutboxStatus.PENDING);
    });
  });

  describe('aviso de cancelamento', () => {
    const canceledEvent = (extra: Record<string, unknown> = {}) =>
      oneOutboxEvent({
        type: OutboxEventType.APPOINTMENT_CANCELED,
        payload: {
          appointmentId: 'appointment-1',
          donorId: 'donor-1',
          collectionUnitId: 'unit-z',
          dateTime: '2026-10-10T13:00:00.000Z',
          reason: 'Unidade de coleta desativada.',
          canceledByStaff: true,
          ...extra,
        },
      });

    it('busca o contato do doador e enfileira o e-mail com a unidade e o motivo', async () => {
      units.add(oneUnit({ id: 'unit-z', name: 'Unidade Zona Sul' }));
      const event = canceledEvent();

      await dispatcher.handle(event);

      expect(event.status).toBe(OutboxStatus.PROCESSED);
      expect(eligibility.findDonorContact).toHaveBeenCalledWith('donor-1');
      expect(publisher.enqueueAppointmentCanceled).toHaveBeenCalledWith({
        type: NotificationJobType.APPOINTMENT_CANCELED,
        appointmentId: 'appointment-1',
        donorId: 'donor-1',
        donorName: 'Fulano',
        recipientEmail: 'fulano@x.com',
        dateTime: '2026-10-10T13:00:00.000Z',
        collectionUnitName: 'Unidade Zona Sul',
        reason: 'Unidade de coleta desativada.',
        canceledByStaff: true,
      });
    });

    it('tira da fila o lembrete e o pedido de confirmação, mesmo de doador excluído', async () => {
      eligibility.findDonorContact.mockResolvedValueOnce(null);

      await dispatcher.handle(canceledEvent());

      expect(publisher.cancelReminder24H).toHaveBeenCalledWith('appointment-1');
      expect(publisher.cancelAttendanceConfirmation).toHaveBeenCalledWith('appointment-1');
    });

    it('se a fila falhar ao remover o lembrete, o evento é reagendado', async () => {
      publisher.cancelReminder24H.mockRejectedValueOnce(new Error('Redis fora'));
      const event = canceledEvent();

      await dispatcher.handle(event);

      expect(event.status).toBe(OutboxStatus.PENDING);
      expect(publisher.enqueueAppointmentCanceled).not.toHaveBeenCalled();
    });

    it('doador excluído (anonimizado) ou inexistente: não há a quem avisar', async () => {
      eligibility.findDonorContact
        .mockResolvedValueOnce({ id: 'donor-1', completeName: 'x', email: 'x', active: false })
        .mockResolvedValueOnce(null);

      await dispatcher.handle(canceledEvent());
      await dispatcher.handle(canceledEvent());

      expect(publisher.enqueueAppointmentCanceled).not.toHaveBeenCalled();
    });

    it('se o eligibility falhar, o evento é reagendado (o aviso não se perde)', async () => {
      eligibility.findDonorContact.mockRejectedValueOnce(new Error('eligibility fora'));
      const event = canceledEvent();

      await dispatcher.handle(event);

      expect(event.status).toBe(OutboxStatus.PENDING);
    });
  });

  describe('aviso de campanha urgente', () => {
    const urgentEvent = (campaignId: string) =>
      oneOutboxEvent({
        type: OutboxEventType.URGENT_CAMPAIGN_CREATED,
        payload: { campaignId },
      });

    it('avisa os doadores aptos do tipo sanguíneo da campanha', async () => {
      campaigns.campaigns.set(
        'c-1',
        oneCampaign({
          id: 'c-1',
          title: 'Precisamos de A-',
          targetBloodType: BloodType.A_NEGATIVE,
        }),
      );
      eligibility.listContactsByBloodType.mockResolvedValue([
        { id: 'd-1', completeName: 'Ana', email: 'ana@x.com' },
      ]);
      const event = urgentEvent('c-1');

      await dispatcher.handle(event);

      expect(event.status).toBe(OutboxStatus.PROCESSED);
      expect(eligibility.listContactsByBloodType).toHaveBeenCalledWith(BloodType.A_NEGATIVE);
      expect(publisher.enqueueUrgentCampaign).toHaveBeenCalledWith(
        expect.objectContaining({
          campaignId: 'c-1',
          title: 'Precisamos de A-',
          recipients: [{ donorId: 'd-1', donorName: 'Ana', recipientEmail: 'ana@x.com' }],
        }),
      );
    });

    it('sem doadores aptos, ou com a campanha já desativada, não enfileira nada', async () => {
      campaigns.campaigns.set('c-1', oneCampaign({ id: 'c-1' }));
      campaigns.campaigns.set('c-2', oneCampaign({ id: 'c-2', active: false }));
      eligibility.listContactsByBloodType.mockResolvedValue([]);

      await dispatcher.handle(urgentEvent('c-1'));
      await dispatcher.handle(urgentEvent('c-2'));

      expect(publisher.enqueueUrgentCampaign).not.toHaveBeenCalled();
    });

    it('evento reprocessado depois do fim da campanha não avisa ninguém', async () => {
      campaigns.campaigns.set('c-1', oneCampaign({ id: 'c-1', endDate: '2026-09-09' }));
      eligibility.listContactsByBloodType.mockResolvedValue([
        { id: 'd-1', completeName: 'Ana', email: 'ana@x.com' },
      ]);
      const event = urgentEvent('c-1');

      await dispatcher.handle(event);

      expect(event.status).toBe(OutboxStatus.PROCESSED);
      expect(eligibility.listContactsByBloodType).not.toHaveBeenCalled();
      expect(publisher.enqueueUrgentCampaign).not.toHaveBeenCalled();
    });

    it('se o eligibility falhar, o evento é reagendado (o aviso não se perde)', async () => {
      campaigns.campaigns.set('c-1', oneCampaign({ id: 'c-1' }));
      eligibility.listContactsByBloodType.mockRejectedValue(new Error('eligibility fora'));
      const event = urgentEvent('c-1');

      await dispatcher.handle(event);

      expect(event.status).toBe(OutboxStatus.PENDING);
      expect(event.attempts).toBe(1);
    });
  });

  describe('handle', () => {
    it('executa a pós-doação e marca o evento como processado', async () => {
      eligibility.completeDonation.mockResolvedValue({ completeName: 'Fulano', email: 'f@x.com' });
      eligibility.assessInternal.mockResolvedValue({ nextEligibilityDate: '2027-01-01' });
      const event = oneOutboxEvent();

      await dispatcher.handle(event);

      expect(event.status).toBe(OutboxStatus.PROCESSED);
      expect(event.processedAt).toEqual(NOW);
      expect(publisher.enqueueIntervalCompleted).toHaveBeenCalledWith(
        expect.objectContaining({
          donorId: 'donor-1',
          recipientEmail: 'f@x.com',
          donorName: 'Fulano',
          nextEligibilityDate: '2027-01-01',
        }),
      );
      expect(eligibility.assessInternal).toHaveBeenCalledWith({
        donorId: 'donor-1',
        origin: AssessmentSource.POST_DONATION,
        appointmentId: expect.any(String),
      });
    });

    it('reagenda com backoff quando o handler falha', async () => {
      eligibility.completeDonation.mockRejectedValue(new Error('indisponível'));
      const event = oneOutboxEvent();

      await dispatcher.handle(event);

      expect(event.status).toBe(OutboxStatus.PENDING);
      expect(event.attempts).toBe(1);
      expect(event.lastError).toBe('indisponível');
      expect(event.nextAttemptAt.getTime()).toBe(NOW.getTime() + 5_000);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('tentativa 1'),
        expect.any(String),
      );
    });

    it('marca FAILURE ao esgotar as tentativas, adia a reativação e registra um alerta', async () => {
      eligibility.completeDonation.mockRejectedValue(new Error('x'));
      const event = oneOutboxEvent({ attempts: OUTBOX_MAX_ATTEMPTS - 1 });

      await dispatcher.handle(event);

      expect(event.status).toBe(OutboxStatus.FAILURE);
      expect(event.nextAttemptAt.getTime()).toBe(NOW.getTime() + 60 * 60_000);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('ALERT: evento evt-1'),
        expect.any(String),
      );
    });

    it('passa a data da doação e o agendamento adiante (idempotência)', async () => {
      eligibility.completeDonation.mockResolvedValue({ completeName: 'Fulano', email: 'f@x.com' });
      eligibility.assessInternal.mockResolvedValue({ nextEligibilityDate: null });
      const event = oneOutboxEvent({
        payload: { appointmentId: 'ag-1', donorId: 'donor-1', donationDate: '2026-09-01' },
      });

      await dispatcher.handle(event);

      expect(eligibility.completeDonation).toHaveBeenCalledWith('donor-1', '2026-09-01');
      expect(publisher.enqueueIntervalCompleted).toHaveBeenCalledWith(
        expect.objectContaining({ appointmentId: 'ag-1' }),
      );
    });

    it('trata um tipo de evento desconhecido como falha', async () => {
      const event = oneOutboxEvent({ type: 'OTHER' as OutboxEventType });

      await dispatcher.handle(event);

      expect(event.attempts).toBe(1);
      expect(event.lastError).toBe(new UnknownEventTypeError('OTHER').message);
      expect(event.lastError).toBe('Tipo de evento desconhecido: OTHER');
    });
  });

  describe('run', () => {
    it('reserva o lote (com prazo) fora de transação e persiste cada evento depois do handler', async () => {
      eligibility.completeDonation.mockResolvedValue({ completeName: 'Fulano', email: 'f@x.com' });
      eligibility.assessInternal.mockResolvedValue({ nextEligibilityDate: null });
      outbox.events.set('e1', oneOutboxEvent({ id: 'e1' }));
      outbox.events.set('e2', oneOutboxEvent({ id: 'e2' }));

      const handled = await dispatcher.execute();

      expect(handled).toBe(2);
      expect(outbox.receivedBatchLimit).toBe(OUTBOX_BATCH);
      expect(outbox.receivedLease).toEqual(new Date(clock.now().getTime() + OUTBOX_LEASE_MS));
      expect(outbox.operationsInTransaction).toEqual([]);
      expect([...outbox.events.values()].map((e) => e.status)).toEqual([
        OutboxStatus.PROCESSED,
        OutboxStatus.PROCESSED,
      ]);
    });

    it('uma falha no handler não impede o resto do lote', async () => {
      eligibility.completeDonation
        .mockRejectedValueOnce(new Error('failed'))
        .mockResolvedValueOnce({ completeName: 'Fulano', email: 'f@x.com' });
      eligibility.assessInternal.mockResolvedValue({ nextEligibilityDate: null });
      outbox.events.set('e1', oneOutboxEvent({ id: 'e1' }));
      outbox.events.set('e2', oneOutboxEvent({ id: 'e2' }));

      await dispatcher.execute();

      expect(outbox.events.get('e1')?.status).toBe(OutboxStatus.PENDING);
      expect(outbox.events.get('e2')?.status).toBe(OutboxStatus.PROCESSED);
    });

    it('sem eventos pendentes, não trata nada', async () => {
      await expect(dispatcher.execute()).resolves.toBe(0);
    });

    it('registra o erro e devolve 0 quando a reserva falha', async () => {
      jest.spyOn(outbox, 'claimPending').mockRejectedValue(new Error('banco fora'));

      await expect(dispatcher.execute()).resolves.toBe(0);

      expect(logger.error).toHaveBeenCalledWith(
        'Falha ao processar outbox: banco fora',
        expect.any(String),
      );
    });

    it('não executa dois lotes ao mesmo tempo na mesma instância', async () => {
      let release: () => void = () => undefined;
      jest
        .spyOn(outbox, 'claimPending')
        .mockImplementation(() => new Promise((resolve) => (release = () => resolve([]))));

      const first = dispatcher.execute();
      await expect(dispatcher.execute()).resolves.toBe(0);
      release();
      await expect(first).resolves.toBe(0);
      expect(outbox.claimPending).toHaveBeenCalledTimes(1);
    });
  });
});

describe('ReconcileOutboxUseCase', () => {
  let outbox: FakeOutboxRepository;
  let logger: ReturnType<typeof createLogger>;
  let reconciliation: ReconcileOutboxUseCase;

  beforeEach(() => {
    outbox = new FakeOutboxRepository();
    outbox.firstEvent = new Date('2026-09-01T00:00:00.000Z');
    logger = createLogger();
    reconciliation = new ReconcileOutboxUseCase(outbox, logger, new FakeClock());
  });

  it('cria um evento para cada conclusão sem evento no outbox', async () => {
    outbox.completionsWithoutEvent = [
      {
        appointmentId: 'ag-1',
        donorId: 'd-1',
        completedAt: new Date('2026-09-10T12:00:00Z'),
        appointmentDateTime: new Date('2026-09-10T12:00:00Z'),
      },
    ];

    const r = await reconciliation.execute();

    expect(r.eventsCreated).toBe(1);
    expect(outbox.completionsQuery).toEqual({
      since: new Date('2026-09-01T00:00:00.000Z'),
      windowDays: OUTBOX_RECONCILIATION_WINDOW_DAYS,
    });
    const [event] = [...outbox.events.values()];
    expect(event.type).toBe(OutboxEventType.DONATION_COMPLETED);
    expect(event.payload).toEqual({
      appointmentId: 'ag-1',
      donorId: 'd-1',
      donationDate: '2026-09-10',
    });
  });

  it('não cria nada quando o outbox ainda não tem nenhum evento (conclusões anteriores a ele)', async () => {
    outbox.firstEvent = null;
    const query = jest.spyOn(outbox, 'listCompletionsWithoutEvent');

    const r = await reconciliation.execute();

    expect(r.eventsCreated).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });

  it('reativa falhas após o período de espera e informa as definitivas', async () => {
    outbox.reactivated = 2;
    outbox.permanentFailures = 1;

    const r = await reconciliation.execute();

    expect(r).toEqual({
      eventsCreated: 0,
      eventsReactivated: 2,
      permanentFailures: 1,
      eventsPurged: 0,
    });
    expect(outbox.reprocessingLimits).toEqual([OUTBOX_MAX_REPROCESSINGS, OUTBOX_MAX_REPROCESSINGS]);
    expect(logger.warn).toHaveBeenCalledWith(
      'Reconciliação: 0 evento(s) criado(s), 2 reativado(s).',
      expect.any(String),
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('1 evento(s) do outbox em FAILURE definitiva'),
      expect.any(String),
    );
  });

  it('sem nada a fazer, não registra aviso nem alerta', async () => {
    await reconciliation.execute();

    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('apaga os eventos processados há mais de 90 dias, e só eles', async () => {
    const processedAt = (days: number) => new Date(NOW.getTime() - days * 86_400_000);
    outbox.events.set(
      'velho',
      oneOutboxEvent({ id: 'velho', status: OutboxStatus.PROCESSED, processedAt: processedAt(91) }),
    );
    outbox.events.set(
      'recente',
      oneOutboxEvent({
        id: 'recente',
        status: OutboxStatus.PROCESSED,
        processedAt: processedAt(10),
      }),
    );
    outbox.events.set('falha', oneOutboxEvent({ id: 'falha', status: OutboxStatus.FAILURE }));

    const r = await reconciliation.execute();

    expect(r.eventsPurged).toBe(1);
    expect([...outbox.events.keys()].sort()).toEqual(['falha', 'recente']);
  });

  it('não propaga erro: o ciclo seguinte tenta de novo', async () => {
    jest.spyOn(outbox, 'findFirstEventDate').mockRejectedValue(new Error('banco fora do ar'));

    await expect(reconciliation.execute()).resolves.toEqual({
      eventsCreated: 0,
      eventsReactivated: 0,
      permanentFailures: 0,
      eventsPurged: 0,
    });
    expect(logger.error).toHaveBeenCalledWith(
      'Falha na reconciliação do outbox: banco fora do ar',
      expect.any(String),
    );
  });
});

describe('administração do outbox', () => {
  let outbox: FakeOutboxRepository;

  beforeEach(() => {
    outbox = new FakeOutboxRepository();
    outbox.events.set(
      'failure',
      oneOutboxEvent({ id: 'failure', status: OutboxStatus.FAILURE, attempts: 8 }),
    );
    outbox.events.set('pending', oneOutboxEvent({ id: 'pending' }));
  });

  it('lista só os eventos em FAILURE', async () => {
    const failures = await new ListOutboxFailuresUseCase(outbox).execute();

    expect(failures.map((e) => e.id)).toEqual(['failure']);
  });

  it('reprocessa um evento em FAILURE: volta para PENDING com as tentativas zeradas', async () => {
    const clock = new FakeClock();
    clock.advanceMs(1_000);

    const event = await new ReprocessEventOutboxUseCase(outbox, clock).execute('failure');

    expect(event.status).toBe(OutboxStatus.PENDING);
    expect(event.attempts).toBe(0);
    expect(event.nextAttemptAt).toEqual(clock.now());
    expect(outbox.events.get('failure')?.status).toBe(OutboxStatus.PENDING);
  });

  it('não reprocessa evento inexistente nem evento que não está em FAILURE', async () => {
    const reprocess = new ReprocessEventOutboxUseCase(outbox, new FakeClock());
    const error = new NotFoundError('Evento não encontrado ou não está em FAILURE.');

    await expect(reprocess.execute('not-exists')).rejects.toThrow(error);
    await expect(reprocess.execute('pending')).rejects.toThrow(error);
  });
});
