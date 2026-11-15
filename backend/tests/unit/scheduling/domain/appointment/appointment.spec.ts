import { AssessmentNotice } from '@shared/domain/enums';
import { AppointmentStatus } from '@src/domain/enums';
import { BusinessRuleError, InvalidValueError } from '@src/domain/errors';
import { Appointment, AppointmentProps } from '@src/domain/appointment/appointment';

const NOW = new Date('2026-09-10T12:00:00.000Z');
const inHours = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000);

function oneAppointment(partial: Partial<AppointmentProps> = {}): Appointment {
  return new Appointment({
    id: 'ag-1',
    donorId: 'donor-1',
    collectionUnitId: 'unit-1',
    campaignId: null,
    dateTime: inHours(30),
    status: AppointmentStatus.ELIGIBILITY_CONFIRMED,
    assessmentEligibilityId: 'assessment-1',
    cancellationReason: null,
    confirmedAt: null,
    checkinAt: null,
    completedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    ...partial,
  });
}

const ALL_STATUSES = Object.values(AppointmentStatus);
const except = (...deleted: AppointmentStatus[]) =>
  ALL_STATUSES.filter((s) => !deleted.includes(s));

describe('Appointment', () => {
  describe('new', () => {
    it('nasce SCHEDULED, sem campanha por padrão', () => {
      const draft = Appointment.draft(
        { donorId: 'd', collectionUnitId: 'u', dateTime: inHours(2) },
        NOW,
      );

      expect(draft).toEqual({
        donorId: 'd',
        collectionUnitId: 'u',
        campaignId: null,
        dateTime: inHours(2),
        status: AppointmentStatus.SCHEDULED,
      });
    });

    it('guarda a campanha informada', () => {
      const draft = Appointment.draft(
        { donorId: 'd', collectionUnitId: 'u', campaignId: 'c', dateTime: inHours(2) },
        NOW,
      );

      expect(draft.campaignId).toBe('c');
    });

    it.each([
      ['no passado', inHours(-1)],
      ['exatamente agora', NOW],
      ['inválida', new Date('nao é data')],
    ])('rejeita dateTime %s', (_name, dateTime) => {
      expect(() =>
        Appointment.draft({ donorId: 'd', collectionUnitId: 'u', dateTime }, NOW),
      ).toThrow(
        new InvalidValueError('A data/hora do agendamento deve ser válida e estar no futuro.'),
      );
    });
  });

  describe('queries', () => {
    it.each(
      ALL_STATUSES.map((status) => [
        status,
        [
          AppointmentStatus.SCHEDULED,
          AppointmentStatus.ELIGIBILITY_CONFIRMED,
          AppointmentStatus.CONFIRMED,
          AppointmentStatus.CHECKIN_PERFORMED,
          AppointmentStatus.COMPLETED,
        ].includes(status),
      ]),
    )('occupiesSlot no status %s: %s', (status, expected) => {
      expect(oneAppointment({ status: status as AppointmentStatus }).occupiesSlot()).toBe(expected);
    });

    it.each(ALL_STATUSES)('awaitsAttendance no status %s', (status) => {
      const expected = [
        AppointmentStatus.ELIGIBILITY_CONFIRMED,
        AppointmentStatus.CONFIRMED,
      ].includes(status);
      expect(oneAppointment({ status }).awaitsAttendance()).toBe(expected);
    });

    it('belongsToDonor compara o id do doador', () => {
      const appointment = oneAppointment();
      expect(appointment.belongsToDonor('donor-1')).toBe(true);
      expect(appointment.belongsToDonor('other')).toBe(false);
      expect(appointment.belongsToDonor(undefined)).toBe(false);
    });

    it('businessDay devolve o dia de calendário em Brasília, não em UTC', () => {
      // 23h30 UTC de 15/09 = 20h30 de 15/09 em Brasília; 01h30 UTC de 16/09 = 22h30 de 15/09.
      expect(oneAppointment({ dateTime: new Date('2026-09-15T23:30:00.000Z') }).businessDay()).toBe(
        '2026-09-15',
      );
      expect(oneAppointment({ dateTime: new Date('2026-09-16T01:30:00.000Z') }).businessDay()).toBe(
        '2026-09-15',
      );
    });
  });

  describe('registerEligibilityAssessment', () => {
    it('apto: SCHEDULED -> ELIGIBILITY_CONFIRMED e guarda a avaliação', () => {
      const appointment = oneAppointment({
        status: AppointmentStatus.SCHEDULED,
        assessmentEligibilityId: null,
      });

      appointment.registerEligibilityAssessment('assessment-9', true);

      expect(appointment.status).toBe(AppointmentStatus.ELIGIBILITY_CONFIRMED);
      expect(appointment.assessmentEligibilityId).toBe('assessment-9');
    });

    it('inapto: SCHEDULED -> ELIGIBILITY_DENIED', () => {
      const appointment = oneAppointment({ status: AppointmentStatus.SCHEDULED });

      appointment.registerEligibilityAssessment('assessment-9', false);

      expect(appointment.status).toBe(AppointmentStatus.ELIGIBILITY_DENIED);
    });

    it('guarda os avisos da avaliação apta e descarta os de uma inapta', () => {
      const eligible = oneAppointment({ status: AppointmentStatus.SCHEDULED });
      eligible.registerEligibilityAssessment('a', true, [AssessmentNotice.BRING_GUARDIAN_CONSENT]);
      expect(eligible.eligibilityNotices).toEqual([AssessmentNotice.BRING_GUARDIAN_CONSENT]);

      const denied = oneAppointment({ status: AppointmentStatus.SCHEDULED });
      denied.registerEligibilityAssessment('a', false, [AssessmentNotice.BRING_GUARDIAN_CONSENT]);
      expect(denied.eligibilityNotices).toEqual([]);
    });

    it.each(except(AppointmentStatus.SCHEDULED))('rejeita no status %s', (status) => {
      expect(() => oneAppointment({ status }).registerEligibilityAssessment('a', true)).toThrow(
        BusinessRuleError,
      );
    });
  });

  describe('confirmAttendance', () => {
    it('ELIGIBILITY_CONFIRMED -> CONFIRMED, gravando o instante, e devolve true', () => {
      const appointment = oneAppointment();

      expect(appointment.confirmAttendance(NOW)).toBe(true);

      expect(appointment.status).toBe(AppointmentStatus.CONFIRMED);
      expect(appointment.confirmedAt).toBe(NOW);
    });

    it('é idempotente: se já está CONFIRMED, devolve false e não altera nada', () => {
      const confirmedAt = inHours(-5);
      const appointment = oneAppointment({ status: AppointmentStatus.CONFIRMED, confirmedAt });

      expect(appointment.confirmAttendance(NOW)).toBe(false);

      expect(appointment.confirmedAt).toBe(confirmedAt);
    });

    it('continua idempotente mesmo depois do horário do agendamento', () => {
      const appointment = oneAppointment({
        status: AppointmentStatus.CONFIRMED,
        dateTime: inHours(-1),
      });

      expect(appointment.confirmAttendance(NOW)).toBe(false);
    });

    it.each(except(AppointmentStatus.ELIGIBILITY_CONFIRMED, AppointmentStatus.CONFIRMED))(
      'rejeita no status %s',
      (status) => {
        expect(() => oneAppointment({ status }).confirmAttendance(NOW)).toThrow(
          new BusinessRuleError(
            'Só é possível confirmar presença em agendamentos com elegibilidade confirmada.',
          ),
        );
      },
    );

    it('rejeita quando o horário já passou (inclusive exatamente agora)', () => {
      expect(() => oneAppointment({ dateTime: inHours(-1) }).confirmAttendance(NOW)).toThrow(
        new BusinessRuleError('O horário deste agendamento já passou.'),
      );
      expect(() => oneAppointment({ dateTime: NOW }).confirmAttendance(NOW)).toThrow(
        BusinessRuleError,
      );
    });
  });

  describe('makeCheckin', () => {
    // NOW = 12:00Z de 10/09 (09:00 em Brasília); o agendamento às 14:00Z é no mesmo dia.
    it.each([AppointmentStatus.ELIGIBILITY_CONFIRMED, AppointmentStatus.CONFIRMED])(
      '%s -> CHECKIN_PERFORMED, gravando o instante',
      (status) => {
        const appointment = oneAppointment({ status, dateTime: inHours(2) });

        appointment.makeCheckin(NOW);

        expect(appointment.status).toBe(AppointmentStatus.CHECKIN_PERFORMED);
        expect(appointment.checkinAt).toBe(NOW);
      },
    );

    it.each(except(AppointmentStatus.ELIGIBILITY_CONFIRMED, AppointmentStatus.CONFIRMED))(
      'rejeita no status %s',
      (status) => {
        const appointment = oneAppointment({ status, dateTime: inHours(2) });

        expect(() => appointment.makeCheckin(NOW)).toThrow(
          new BusinessRuleError('O agendamento não está em um estado que permita check-in.'),
        );
        expect(appointment.checkinAt).toBeNull();
      },
    );

    it('só no dia do agendamento (horário de Brasília), mesmo antes ou depois do horário', () => {
      // Atrasado, ainda no mesmo dia: pode.
      expect(() => oneAppointment({ dateTime: inHours(-2) }).makeCheckin(NOW)).not.toThrow();
      // Amanhã: ainda não.
      expect(() => oneAppointment({ dateTime: inHours(30) }).makeCheckin(NOW)).toThrow(
        new BusinessRuleError('O check-in só pode ser feito no dia do agendamento (11/09/2026).'),
      );
      // Ontem: não (o certo é marcar o não comparecimento).
      expect(() => oneAppointment({ dateTime: inHours(-24) }).makeCheckin(NOW)).toThrow(
        BusinessRuleError,
      );
    });

    it('usa o dia de Brasília: 22h de 10/09 (01:00Z de 11/09) ainda é 10/09', () => {
      const appointment = oneAppointment({ dateTime: new Date('2026-09-11T01:00:00.000Z') });
      expect(() => appointment.makeCheckin(NOW)).not.toThrow();
    });
  });

  describe('complete', () => {
    it('CHECKIN_PERFORMED -> COMPLETED, gravando o instante', () => {
      const appointment = oneAppointment({ status: AppointmentStatus.CHECKIN_PERFORMED });

      appointment.complete(NOW);

      expect(appointment.status).toBe(AppointmentStatus.COMPLETED);
      expect(appointment.completedAt).toBe(NOW);
    });

    it.each(except(AppointmentStatus.CHECKIN_PERFORMED))('rejeita no status %s', (status) => {
      const appointment = oneAppointment({ status });

      expect(() => appointment.complete(NOW)).toThrow(
        new BusinessRuleError(
          'O agendamento precisa ter passado por check-in antes de ser concluído.',
        ),
      );
      expect(appointment.completedAt).toBeNull();
    });
  });

  describe('markNoShow', () => {
    it.each([AppointmentStatus.ELIGIBILITY_CONFIRMED, AppointmentStatus.CONFIRMED])(
      '%s com horário passado -> NO_SHOW',
      (status) => {
        const appointment = oneAppointment({ status, dateTime: inHours(-1) });

        appointment.markNoShow(NOW);

        expect(appointment.status).toBe(AppointmentStatus.NO_SHOW);
      },
    );

    it('aceita exatamente o horário agendado', () => {
      const appointment = oneAppointment({ dateTime: NOW });

      appointment.markNoShow(NOW);

      expect(appointment.status).toBe(AppointmentStatus.NO_SHOW);
    });

    it('rejeita antes do horário agendado', () => {
      const appointment = oneAppointment({ dateTime: inHours(1) });

      expect(() => appointment.markNoShow(NOW)).toThrow(
        new BusinessRuleError(
          'Não é possível marcar não comparecimento antes do horário agendado.',
        ),
      );
      expect(appointment.status).toBe(AppointmentStatus.ELIGIBILITY_CONFIRMED);
    });

    it.each(except(AppointmentStatus.ELIGIBILITY_CONFIRMED, AppointmentStatus.CONFIRMED))(
      'rejeita no status %s',
      (status) => {
        expect(() => oneAppointment({ status, dateTime: inHours(-1) }).markNoShow(NOW)).toThrow(
          new BusinessRuleError(
            'Só é possível marcar não comparecimento em agendamentos com elegibilidade confirmada.',
          ),
        );
      },
    );
  });

  describe('cancel', () => {
    const beforeCheckin = [
      AppointmentStatus.SCHEDULED,
      AppointmentStatus.ELIGIBILITY_CONFIRMED,
      AppointmentStatus.CONFIRMED,
    ];
    const closed = [
      AppointmentStatus.COMPLETED,
      AppointmentStatus.CANCELED,
      AppointmentStatus.NO_SHOW,
      AppointmentStatus.ELIGIBILITY_DENIED,
    ];

    it.each(beforeCheckin)('doador: %s -> CANCELED, guardando o motivo', (status) => {
      const appointment = oneAppointment({ status, dateTime: inHours(5) });

      appointment.cancel(NOW, false, 'Imprevisto');

      expect(appointment.status).toBe(AppointmentStatus.CANCELED);
      expect(appointment.cancellationReason).toBe('Imprevisto');
    });

    it('sem motivo, grava cancellationReason nulo', () => {
      const appointment = oneAppointment({ cancellationReason: 'antigo', dateTime: inHours(5) });

      appointment.cancel(NOW, false);

      expect(appointment.cancellationReason).toBeNull();
    });

    it('doador não cancela depois do horário nem depois do check-in; a equipe sim', () => {
      expect(() =>
        oneAppointment({ status: AppointmentStatus.CONFIRMED, dateTime: inHours(-1) }).cancel(
          NOW,
          false,
        ),
      ).toThrow(/já passou/);
      expect(() =>
        oneAppointment({ status: AppointmentStatus.CHECKIN_PERFORMED }).cancel(NOW, false),
      ).toThrow(new BusinessRuleError('Este agendamento não pode mais ser cancelado.'));

      const late = oneAppointment({ status: AppointmentStatus.CONFIRMED, dateTime: inHours(-1) });
      late.cancel(NOW, true);
      expect(late.status).toBe(AppointmentStatus.CANCELED);
      const checkedIn = oneAppointment({ status: AppointmentStatus.CHECKIN_PERFORMED });
      checkedIn.cancel(NOW, true, 'Triagem clínica');
      expect(checkedIn.status).toBe(AppointmentStatus.CANCELED);
    });

    it.each(closed)('ninguém cancela um agendamento encerrado (%s)', (status) => {
      for (const byStaff of [false, true]) {
        expect(() => oneAppointment({ status }).cancel(NOW, byStaff)).toThrow(
          new BusinessRuleError('Este agendamento não pode mais ser cancelado.'),
        );
      }
    });
  });

  describe('grade de horários e agendamento em aberto', () => {
    it.each([
      ['14:05', inHours(2).getTime() + 5 * 60_000],
      ['com segundos', inHours(2).getTime() + 1_000],
    ])('recusa horário fora da grade de 30 min (%s)', (_d, ms) => {
      expect(() =>
        Appointment.draft({ donorId: 'd', collectionUnitId: 'u', dateTime: new Date(ms) }, NOW),
      ).toThrow(InvalidValueError);
    });

    it('aceita horários cheios e meias horas', () => {
      for (const ms of [inHours(2).getTime(), inHours(2).getTime() + 30 * 60_000]) {
        expect(
          Appointment.draft({ donorId: 'd', collectionUnitId: 'u', dateTime: new Date(ms) }, NOW)
            .status,
        ).toBe(AppointmentStatus.SCHEDULED);
      }
    });

    it('aceita até 90 dias de antecedência (pelo dia de Brasília) e recusa depois disso', () => {
      const draft = (days: number) =>
        Appointment.draft(
          { donorId: 'd', collectionUnitId: 'u', dateTime: inHours(days * 24) },
          NOW,
        );
      expect(draft(90).status).toBe(AppointmentStatus.SCHEDULED);
      expect(() => draft(91)).toThrow('até 90 dias de antecedência');
    });

    it('fica em aberto até o fim do dia do agendamento, ou depois do check-in', () => {
      const open = (status: AppointmentStatus, hours: number) =>
        oneAppointment({ status, dateTime: inHours(hours) }).isOpenForDonor(NOW);
      expect(open(AppointmentStatus.CONFIRMED, 5)).toBe(true);
      // NOW é 09:00 em Brasília: 1 h atrás ainda é hoje (o check-in vale o dia todo); ontem, não.
      expect(open(AppointmentStatus.CONFIRMED, -1)).toBe(true);
      expect(open(AppointmentStatus.CONFIRMED, -10)).toBe(false);
      expect(open(AppointmentStatus.CHECKIN_PERFORMED, -1)).toBe(true);
      expect(open(AppointmentStatus.COMPLETED, 5)).toBe(false);
      expect(open(AppointmentStatus.CANCELED, 5)).toBe(false);
    });
  });

  it('carrega só dados (sem métodos); a resposta da API é montada pelos presenters', () => {
    const json = JSON.parse(JSON.stringify(oneAppointment()));

    expect(Object.keys(json).sort()).toEqual(
      [
        'id',
        'donorId',
        'collectionUnitId',
        'campaignId',
        'dateTime',
        'status',
        'assessmentEligibilityId',
        'eligibilityNotices',
        'cancellationReason',
        'confirmedAt',
        'checkinAt',
        'completedAt',
        'createdAt',
        'updatedAt',
        'version',
      ].sort(),
    );
  });
});
