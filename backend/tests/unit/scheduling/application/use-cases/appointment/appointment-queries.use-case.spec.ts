import { AppointmentStatus } from '@src/domain/enums';
import { AccessDeniedError, NotFoundError } from '@src/application/errors';
import { AppointmentsEnvironment, buildAppointmentsEnvironment } from '@test/support/environment';
import { admin, donor, hoursFromNow, oneAppointment, oneUnit } from '@test/support/builders';
import { FindAppointmentUseCase } from '@src/application/use-cases/appointment/find-appointment.use-case';
import { ListDonorAppointmentsUseCase } from '@src/application/use-cases/appointment/list-donor-appointments.use-case';

describe('consultas de agendamento', () => {
  let environment: AppointmentsEnvironment;

  beforeEach(() => {
    environment = buildAppointmentsEnvironment();
  });

  describe('ListAppointmentsUseCase', () => {
    it('lista sem filtros quando nenhum é informado', async () => {
      environment.appointments.appointments.set('appointment-1', oneAppointment());

      const result = await environment.list.execute({});

      expect(result).toHaveLength(1);
      expect(environment.appointments.receivedFilters[0]).toEqual({
        status: undefined,
        collectionUnitId: undefined,
        period: undefined,
      });
    });

    it('aplica os filtros de status, unidade e o intervalo UTC do dia informado', async () => {
      await environment.list.execute({
        status: AppointmentStatus.SCHEDULED,
        collectionUnitId: 'unit-1',
        date: '2026-09-15',
      });

      expect(environment.appointments.receivedFilters[0]).toEqual({
        status: AppointmentStatus.SCHEDULED,
        collectionUnitId: 'unit-1',
        period: {
          start: new Date('2026-09-15T03:00:00.000Z'),
          end: new Date('2026-09-16T02:59:59.999Z'),
        },
      });
    });
  });

  describe('ListDonorAppointmentsUseCase', () => {
    it('devolve só os agendamentos do doador, do mais recente ao mais antigo', async () => {
      environment.appointments.appointments.set(
        'a1',
        oneAppointment({ id: 'a1', dateTime: hoursFromNow(10) }),
      );
      environment.appointments.appointments.set(
        'a2',
        oneAppointment({ id: 'a2', dateTime: hoursFromNow(50) }),
      );
      environment.appointments.appointments.set(
        'a3',
        oneAppointment({ id: 'a3', donorId: 'other-donor' }),
      );

      const result = await new ListDonorAppointmentsUseCase(environment.appointments).execute(
        'donor-1',
      );

      expect(result.map((a) => a.id)).toEqual(['a2', 'a1']);
    });

    it('sem doador (ex.: admin em /appointments/me) não lista nada', async () => {
      environment.appointments.appointments.set('a1', oneAppointment({ id: 'a1' }));
      const spy = jest.spyOn(environment.appointments, 'listByDonor');

      const useCase = new ListDonorAppointmentsUseCase(environment.appointments);

      await expect(useCase.execute(undefined)).resolves.toEqual([]);
      await expect(useCase.execute(null)).resolves.toEqual([]);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('FindAppointmentUseCase', () => {
    it('devolve o agendamento ou lança NotFoundError', async () => {
      environment.appointments.appointments.set('appointment-1', oneAppointment());
      const find = new FindAppointmentUseCase(environment.appointments);

      await expect(find.execute('appointment-1', admin())).resolves.toMatchObject({
        id: 'appointment-1',
      });
      await expect(find.execute('not-exists', admin())).rejects.toThrow(
        new NotFoundError('Agendamento não encontrado.'),
      );
    });

    it('doador só vê o próprio agendamento', async () => {
      const appointment = oneAppointment();
      environment.appointments.appointments.set('appointment-1', appointment);
      const find = new FindAppointmentUseCase(environment.appointments);

      await expect(
        find.execute('appointment-1', donor(appointment.donorId)),
      ).resolves.toBeDefined();
      await expect(find.execute('appointment-1', donor('another'))).rejects.toBeInstanceOf(
        AccessDeniedError,
      );
    });
  });

  describe('CheckAvailabilityUseCase', () => {
    const day = '2026-09-11';
    const dateTime = new Date(`${day}T14:00:00.000Z`);

    beforeEach(() => {
      environment.units.add(oneUnit({ simultaneousCapacity: 3 }));
    });

    it('lança NotFoundError para uma unidade inexistente', async () => {
      await expect(environment.availability.execute('not-exists', day)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it('calcula vagas ocupadas e disponíveis por horário, contando só quem ocupa vaga', async () => {
      const { appointments } = environment;
      appointments.appointments.set('a1', oneAppointment({ id: 'a1', dateTime }));
      appointments.appointments.set(
        'a2',
        oneAppointment({ id: 'a2', dateTime, status: AppointmentStatus.CONFIRMED }),
      );
      appointments.appointments.set(
        'a3',
        oneAppointment({ id: 'a3', dateTime, status: AppointmentStatus.CANCELED }),
      );

      const result = await environment.availability.execute('unit-1', day);

      expect(result).toEqual({
        collectionUnitId: 'unit-1',
        date: day,
        simultaneousCapacity: 3,
        times: [{ dateTime: dateTime.toISOString(), occupiedSlots: 2, availableSlots: 1 }],
      });
    });

    it('guarda o resultado no cache por 20 segundos e o usa na consulta seguinte', async () => {
      environment.appointments.appointments.set('a1', oneAppointment({ id: 'a1', dateTime }));

      const first = await environment.availability.execute('unit-1', day);
      environment.appointments.appointments.clear();
      const second = await environment.availability.execute('unit-1', day);

      expect(environment.cache.writes).toEqual([{ key: `unit-1:${day}`, ttlSeconds: 20 }]);
      expect(second).toBe(first);
    });

    it('depois de uma invalidação do dia, volta a consultar o banco', async () => {
      await environment.availability.execute('unit-1', day);
      await environment.cache.invalidateDay('unit-1', dateTime);

      environment.appointments.appointments.set('a1', oneAppointment({ id: 'a1', dateTime }));
      const result = await environment.availability.execute('unit-1', day);

      expect(result.times).toHaveLength(1);
    });
  });
});
