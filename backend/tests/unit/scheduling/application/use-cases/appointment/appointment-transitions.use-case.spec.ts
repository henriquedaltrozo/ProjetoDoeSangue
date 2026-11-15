import { AssessmentSource, EligibilityResult } from '@shared/domain/enums';
import { AppointmentStatus } from '@src/domain/enums';
import { BusinessRuleError } from '@src/domain/errors';
import { OutboxStatus, OutboxEventType } from '@src/domain/outbox';
import { AccessDeniedError, ConflictError, NotFoundError } from '@src/application/errors';
import { AppointmentsEnvironment, buildAppointmentsEnvironment } from '@test/support/environment';
import { NOW, admin, donor, hoursFromNow, oneAppointment } from '@test/support/builders';

describe('transições de agendamento', () => {
  let environment: AppointmentsEnvironment;

  beforeEach(() => {
    environment = buildAppointmentsEnvironment();
  });

  describe('PerformCheckinUseCase', () => {
    it('permite o check-in de um agendamento ELIGIBILITY_CONFIRMED e registra o instante', async () => {
      environment.appointments.appointments.set(
        'appointment-1',
        oneAppointment({ dateTime: hoursFromNow(2) }),
      );

      const result = await environment.checkin.execute('appointment-1');

      expect(result.status).toBe(AppointmentStatus.CHECKIN_PERFORMED);
      expect(result.checkinAt).toEqual(NOW);
      expect(environment.appointments.saves).toBe(1);
    });

    it('permite o check-in de um agendamento CONFIRMED', async () => {
      environment.appointments.appointments.set(
        'appointment-1',
        oneAppointment({ status: AppointmentStatus.CONFIRMED, dateTime: hoursFromNow(2) }),
      );

      const result = await environment.checkin.execute('appointment-1');

      expect(result.status).toBe(AppointmentStatus.CHECKIN_PERFORMED);
    });

    it('só permite check-in quando a presença é esperada', async () => {
      environment.appointments.appointments.set(
        'appointment-1',
        oneAppointment({ status: AppointmentStatus.SCHEDULED, dateTime: hoursFromNow(2) }),
      );

      await expect(environment.checkin.execute('appointment-1')).rejects.toBeInstanceOf(
        BusinessRuleError,
      );
      expect(environment.appointments.saves).toBe(0);
    });

    it('fora do dia do agendamento, recusa sem reavaliar (nada vai para o histórico)', async () => {
      environment.appointments.appointments.set(
        'appointment-1',
        oneAppointment({ dateTime: hoursFromNow(48) }),
      );

      await expect(environment.checkin.execute('appointment-1')).rejects.toThrow(
        /só pode ser feito no dia do agendamento/,
      );
      expect(environment.eligibility.assessInternal).not.toHaveBeenCalled();
      expect(environment.appointments.saves).toBe(0);
    });

    it('lança NotFoundError para um agendamento inexistente', async () => {
      await expect(environment.checkin.execute('not-exists')).rejects.toThrow(
        new NotFoundError('Agendamento não encontrado.'),
      );
    });

    it('reavalia a elegibilidade para hoje antes do check-in', async () => {
      environment.appointments.appointments.set(
        'appointment-1',
        oneAppointment({ dateTime: hoursFromNow(2) }),
      );

      await environment.checkin.execute('appointment-1');

      expect(environment.eligibility.assessInternal).toHaveBeenCalledWith({
        donorId: 'donor-1',
        origin: AssessmentSource.APPOINTMENT_VALIDATION,
        appointmentId: 'appointment-1',
        donationDate: '2026-09-10',
      });
    });

    it('recusa o check-in se o doador deixou de estar apto', async () => {
      environment.appointments.appointments.set(
        'appointment-1',
        oneAppointment({ dateTime: hoursFromNow(2) }),
      );
      environment.eligibility.assessInternal.mockResolvedValueOnce({
        id: 'a',
        result: EligibilityResult.TEMPORARY_UNFIT,
        reasons: ['ACTIVE_TEMPORARY_UNFITNESS'],
        notices: [],
        nextEligibilityDate: null,
      });

      await expect(environment.checkin.execute('appointment-1')).rejects.toThrow(/não está apto/);
      expect(environment.appointments.saves).toBe(0);
    });
  });

  describe('CancelDonorAppointmentsUseCase (exclusão de conta)', () => {
    it('cancela só os agendamentos em aberto do doador e remove os lembretes', async () => {
      environment.appointments.appointments.set('a-open', oneAppointment({ id: 'a-open' }));
      environment.appointments.appointments.set(
        'a-done',
        oneAppointment({ id: 'a-done', status: AppointmentStatus.COMPLETED }),
      );
      environment.appointments.appointments.set(
        'a-other',
        oneAppointment({ id: 'a-other', donorId: 'donor-2' }),
      );

      await expect(environment.cancelDonorAppointments.execute('donor-1')).resolves.toEqual({
        canceled: 1,
      });

      expect(environment.appointments.appointments.get('a-open')?.status).toBe(
        AppointmentStatus.CANCELED,
      );
      expect(environment.appointments.appointments.get('a-done')?.status).toBe(
        AppointmentStatus.COMPLETED,
      );
      expect(environment.appointments.appointments.get('a-other')?.status).toBe(
        AppointmentStatus.ELIGIBILITY_CONFIRMED,
      );
      expect(environment.publisher.cancelReminder24H).toHaveBeenCalledWith('a-open');
    });
  });

  describe('CompleteAppointmentUseCase', () => {
    beforeEach(() => {
      environment.appointments.appointments.set(
        'ag-1',
        oneAppointment({
          id: 'ag-1',
          donorId: 'd-1',
          collectionUnitId: 'u-1',
          dateTime: NOW,
          status: AppointmentStatus.CHECKIN_PERFORMED,
        }),
      );
    });

    it('conclui gravando status e evento de outbox na mesma transação', async () => {
      const result = await environment.complete.execute('ag-1');

      expect(result.status).toBe(AppointmentStatus.COMPLETED);
      expect(result.completedAt).toEqual(NOW);
      expect(environment.unitOfWork.transactions).toBe(1);
      expect(environment.appointments.operationsInTransaction).toEqual(['save']);
      expect(environment.outbox.operationsInTransaction).toEqual(['create']);
    });

    it('o evento do outbox leva o agendamento, o doador e a data da doação', async () => {
      await environment.complete.execute('ag-1');

      const [event] = [...environment.outbox.events.values()];
      expect(event.type).toBe(OutboxEventType.DONATION_COMPLETED);
      expect(event.status).toBe(OutboxStatus.PENDING);
      expect(event.payload).toEqual({
        appointmentId: 'ag-1',
        donorId: 'd-1',
        donationDate: '2026-09-10',
      });
    });

    it('não chama o eligibility-service diretamente (isso é papel do despachante do outbox)', async () => {
      await environment.complete.execute('ag-1');

      expect(environment.eligibility.completeDonation).not.toHaveBeenCalled();
    });

    it('invalida o cache de disponibilidade do dia', async () => {
      await environment.complete.execute('ag-1');

      expect(environment.cache.invalidations).toEqual(['u-1:2026-09-10']);
    });

    it('exige o check-in antes e não grava evento se a transição for inválida', async () => {
      environment.appointments.appointments.set(
        'ag-2',
        oneAppointment({ id: 'ag-2', status: AppointmentStatus.CONFIRMED }),
      );

      await expect(environment.complete.execute('ag-2')).rejects.toBeInstanceOf(BusinessRuleError);
      expect(environment.outbox.events.size).toBe(0);
    });

    it('desfaz o status se gravar o evento do outbox falhar', async () => {
      jest.spyOn(environment.outbox, 'create').mockRejectedValue(new Error('banco caiu'));

      await expect(environment.complete.execute('ag-1')).rejects.toThrow('banco caiu');

      expect(environment.outbox.events.size).toBe(0);
      expect(environment.cache.invalidations).toEqual([]);
    });
  });

  describe('MarkNoShowUseCase', () => {
    it('marca NO_SHOW quando ELIGIBILITY_CONFIRMED e o horário já passou', async () => {
      environment.appointments.appointments.set(
        'appointment-1',
        oneAppointment({ dateTime: hoursFromNow(-1) }),
      );

      const result = await environment.noShow.execute('appointment-1');

      expect(result.status).toBe(AppointmentStatus.NO_SHOW);
      expect(environment.publisher.cancelReminder24H).toHaveBeenCalledWith('appointment-1');
      expect(environment.publisher.cancelAttendanceConfirmation).toHaveBeenCalledWith(
        'appointment-1',
      );
      expect(environment.cache.invalidations).toHaveLength(1);
      // O convite para reagendar vai pelo outbox, na mesma transação.
      const [event] = [...environment.outbox.events.values()];
      expect(event.type).toBe(OutboxEventType.APPOINTMENT_NO_SHOW);
      expect(event.payload).toMatchObject({ appointmentId: 'appointment-1', donorId: 'donor-1' });
    });

    it('permite marcar não comparecimento de um agendamento CONFIRMED com horário passado', async () => {
      environment.appointments.appointments.set(
        'appointment-1',
        oneAppointment({ status: AppointmentStatus.CONFIRMED, dateTime: hoursFromNow(-1) }),
      );

      const result = await environment.noShow.execute('appointment-1');

      expect(result.status).toBe(AppointmentStatus.NO_SHOW);
    });

    it('rejeita quando o agendamento não está com elegibilidade confirmada', async () => {
      environment.appointments.appointments.set(
        'appointment-1',
        oneAppointment({ status: AppointmentStatus.SCHEDULED, dateTime: hoursFromNow(-1) }),
      );

      await expect(environment.noShow.execute('appointment-1')).rejects.toBeInstanceOf(
        BusinessRuleError,
      );
    });

    it('rejeita quando o horário do agendamento ainda não passou', async () => {
      environment.appointments.appointments.set(
        'appointment-1',
        oneAppointment({ dateTime: hoursFromNow(1) }),
      );

      await expect(environment.noShow.execute('appointment-1')).rejects.toBeInstanceOf(
        BusinessRuleError,
      );
      expect(environment.publisher.cancelReminder24H).not.toHaveBeenCalled();
    });
  });

  describe('CancelAppointmentUseCase', () => {
    it('cancela, guarda o motivo, libera o cache e remove o lembrete e o pedido de confirmação', async () => {
      environment.appointments.appointments.set(
        'appointment-1',
        oneAppointment({ status: AppointmentStatus.CONFIRMED }),
      );

      const result = await environment.cancel.execute(
        'appointment-1',
        donor('donor-1'),
        'Imprevisto no trabalho',
      );

      expect(result.status).toBe(AppointmentStatus.CANCELED);
      expect(result.cancellationReason).toBe('Imprevisto no trabalho');
      expect(environment.cache.invalidations).toHaveLength(1);
      expect(environment.publisher.cancelReminder24H).toHaveBeenCalledWith('appointment-1');
      expect(environment.publisher.cancelAttendanceConfirmation).toHaveBeenCalledWith(
        'appointment-1',
      );
    });

    it('grava, na mesma transação, o evento do aviso de cancelamento ao doador', async () => {
      environment.appointments.appointments.set('appointment-1', oneAppointment());

      await environment.cancel.execute('appointment-1', admin(), 'Triagem recusou');

      const events = [...environment.outbox.events.values()];
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(OutboxEventType.APPOINTMENT_CANCELED);
      expect(events[0].payload).toMatchObject({
        appointmentId: 'appointment-1',
        donorId: 'donor-1',
        reason: 'Triagem recusou',
        canceledByStaff: true,
      });
      expect(environment.unitOfWork.transactions).toBe(1);
    });

    it('cancelado pelo próprio doador: o aviso diz que foi ele', async () => {
      environment.appointments.appointments.set('appointment-1', oneAppointment());

      await environment.cancel.execute('appointment-1', donor('donor-1'));

      const [event] = [...environment.outbox.events.values()];
      expect(event.payload).toMatchObject({ canceledByStaff: false, reason: null });
    });

    it('o cancelamento vale mesmo se a fila falhar ao remover os lembretes (só registra o erro)', async () => {
      environment.appointments.appointments.set(
        'appointment-1',
        oneAppointment({ status: AppointmentStatus.CONFIRMED }),
      );
      environment.publisher.cancelReminder24H.mockRejectedValueOnce(new Error('redis fora do ar'));

      const result = await environment.cancel.execute('appointment-1', donor('donor-1'));

      expect(result.status).toBe(AppointmentStatus.CANCELED);
      expect(environment.appointments.appointments.get('appointment-1')?.status).toBe(
        AppointmentStatus.CANCELED,
      );
    });

    it('o doador não cancela um agendamento cujo horário já passou', async () => {
      environment.appointments.appointments.set(
        'appointment-1',
        oneAppointment({ dateTime: hoursFromNow(-1) }),
      );

      await expect(
        environment.cancel.execute('appointment-1', donor('donor-1')),
      ).rejects.toBeInstanceOf(BusinessRuleError);
    });

    it('cancelar e fazer check-in ao mesmo tempo: a segunda transição recebe ConflictError', async () => {
      environment.appointments.appointments.set(
        'appointment-1',
        oneAppointment({ status: AppointmentStatus.CONFIRMED, dateTime: hoursFromNow(2) }),
      );

      const results = await Promise.allSettled([
        environment.cancel.execute('appointment-1', donor('donor-1')),
        environment.checkin.execute('appointment-1'),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect(rejected.reason).toBeInstanceOf(ConflictError);
    });

    it('um admin pode cancelar o agendamento de qualquer doador', async () => {
      environment.appointments.appointments.set('appointment-1', oneAppointment());

      const result = await environment.cancel.execute('appointment-1', admin());

      expect(result.status).toBe(AppointmentStatus.CANCELED);
      expect(result.cancellationReason).toBeNull();
    });

    it('impede cancelar um agendamento já concluído', async () => {
      environment.appointments.appointments.set(
        'appointment-1',
        oneAppointment({ status: AppointmentStatus.COMPLETED }),
      );

      await expect(environment.cancel.execute('appointment-1', donor('donor-1'))).rejects.toThrow(
        new BusinessRuleError('Este agendamento não pode mais ser cancelado.'),
      );
    });

    it('impede um doador de cancelar o agendamento de outro doador', async () => {
      environment.appointments.appointments.set(
        'appointment-1',
        oneAppointment({ status: AppointmentStatus.SCHEDULED }),
      );

      await expect(
        environment.cancel.execute('appointment-1', donor('other-donor')),
      ).rejects.toThrow(new AccessDeniedError('Você só pode cancelar os próprios agendamentos.'));
      expect(environment.appointments.saves).toBe(0);
    });
  });
});
