import { AppointmentStatus } from '@src/domain/enums';
import { BusinessRuleError } from '@src/domain/errors';
import { AccessDeniedError, ExpiredError, NotFoundError } from '@src/application/errors';
import { AppointmentsEnvironment, buildAppointmentsEnvironment } from '@test/support/environment';
import { NOW, admin, donor, hoursFromNow, oneAppointment } from '@test/support/builders';

describe('confirmação de presença', () => {
  let environment: AppointmentsEnvironment;

  beforeEach(() => {
    environment = buildAppointmentsEnvironment();
    environment.appointments.appointments.set('appointment-1', oneAppointment());
  });

  describe('ConfirmAttendanceUseCase (logado)', () => {
    it('o doador confirma: vira CONFIRMED, grava confirmedAt e limpa as pendências da fila', async () => {
      const result = await environment.confirmAttendance.execute('appointment-1', donor('donor-1'));

      expect(result.status).toBe(AppointmentStatus.CONFIRMED);
      expect(result.confirmedAt).toEqual(NOW);
      expect(environment.appointments.saves).toBe(1);
      expect(environment.publisher.cancelAttendanceConfirmation).toHaveBeenCalledWith(
        'appointment-1',
      );
      expect(environment.publisher.removeReminderLink24h).toHaveBeenCalledWith('appointment-1');
    });

    it('duas confirmações ao mesmo tempo (duplo clique): ambas respondem CONFIRMED, sem 409', async () => {
      const results = await Promise.all([
        environment.confirmAttendance.execute('appointment-1', donor('donor-1')),
        environment.confirmAttendance.execute('appointment-1', donor('donor-1')),
      ]);

      expect(results.map((r) => r.status)).toEqual([
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.CONFIRMED,
      ]);
      expect(environment.appointments.saves).toBe(1);
    });

    it('um admin pode confirmar em nome do doador', async () => {
      const result = await environment.confirmAttendance.execute('appointment-1', admin());

      expect(result.status).toBe(AppointmentStatus.CONFIRMED);
    });

    it('impede um doador de confirmar o agendamento de outro doador', async () => {
      await expect(
        environment.confirmAttendance.execute('appointment-1', donor('other-donor')),
      ).rejects.toThrow(
        new AccessDeniedError('Você só pode confirmar presença nos próprios agendamentos.'),
      );
      expect(environment.appointments.saves).toBe(0);
    });

    it('é idempotente: confirmar de novo devolve o agendamento sem regravar', async () => {
      const confirmedAt = new Date('2026-09-09T10:00:00.000Z');
      environment.appointments.appointments.set(
        'appointment-1',
        oneAppointment({ status: AppointmentStatus.CONFIRMED, confirmedAt }),
      );

      const result = await environment.confirmAttendance.execute('appointment-1', donor('donor-1'));

      expect(result.status).toBe(AppointmentStatus.CONFIRMED);
      expect(result.confirmedAt).toBe(confirmedAt);
      expect(environment.appointments.saves).toBe(0);
      expect(environment.publisher.cancelAttendanceConfirmation).not.toHaveBeenCalled();
    });

    it.each([
      AppointmentStatus.SCHEDULED,
      AppointmentStatus.ELIGIBILITY_DENIED,
      AppointmentStatus.CANCELED,
      AppointmentStatus.CHECKIN_PERFORMED,
      AppointmentStatus.COMPLETED,
      AppointmentStatus.NO_SHOW,
    ])('rejeita a confirmação quando o status é %s', async (status) => {
      environment.appointments.appointments.set('appointment-1', oneAppointment({ status }));

      await expect(
        environment.confirmAttendance.execute('appointment-1', donor('donor-1')),
      ).rejects.toBeInstanceOf(BusinessRuleError);
    });

    it('rejeita a confirmação quando o horário do agendamento já passou', async () => {
      environment.appointments.appointments.set(
        'appointment-1',
        oneAppointment({ dateTime: hoursFromNow(-1) }),
      );

      await expect(
        environment.confirmAttendance.execute('appointment-1', donor('donor-1')),
      ).rejects.toThrow(new BusinessRuleError('O horário deste agendamento já passou.'));
    });

    it('mantém a confirmação mesmo se limpar a fila falhar', async () => {
      environment.publisher.cancelAttendanceConfirmation.mockRejectedValue(
        new Error('redis fora do ar'),
      );

      const result = await environment.confirmAttendance.execute('appointment-1', donor('donor-1'));

      expect(result.status).toBe(AppointmentStatus.CONFIRMED);
      expect(environment.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('redis fora do ar'),
        expect.any(String),
      );
    });

    it('lança NotFoundError para um agendamento inexistente', async () => {
      await expect(
        environment.confirmAttendance.execute('not-exists', donor('donor-1')),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('ConfirmAttendanceByTokenUseCase (link do e-mail)', () => {
    it('confirma pelo link, sem login, e devolve só o resumo do agendamento', async () => {
      environment.tokens.verify.mockReturnValue('appointment-1');

      const result = await environment.confirmByToken.execute('token-valid');

      expect(environment.tokens.verify).toHaveBeenCalledWith('token-valid');
      expect(result).toEqual({
        id: 'appointment-1',
        dateTime: expect.any(Date),
        status: AppointmentStatus.CONFIRMED,
        confirmedAt: NOW,
      });
      expect(result).not.toHaveProperty('donorId');
    });

    it('propaga o erro de token inválido ou expirado sem tocar no agendamento', async () => {
      environment.tokens.verify.mockImplementation(() => {
        throw new ExpiredError('Este link de confirmação expirou.');
      });
      const find = jest.spyOn(environment.appointments, 'findById');

      await expect(environment.confirmByToken.execute('token-expired')).rejects.toBeInstanceOf(
        ExpiredError,
      );
      expect(find).not.toHaveBeenCalled();
    });

    it('lança NotFoundError quando o token aponta para um agendamento que não existe mais', async () => {
      environment.tokens.verify.mockReturnValue('apagado');

      await expect(environment.confirmByToken.execute('token')).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it('é idempotente: clicar duas vezes no link não regrava', async () => {
      environment.tokens.verify.mockReturnValue('appointment-1');
      await environment.confirmByToken.execute('token');
      environment.clock.advanceMs(60_000);

      const second = await environment.confirmByToken.execute('token');

      expect(second.confirmedAt).toEqual(NOW);
      expect(environment.appointments.saves).toBe(1);
    });
  });
});
