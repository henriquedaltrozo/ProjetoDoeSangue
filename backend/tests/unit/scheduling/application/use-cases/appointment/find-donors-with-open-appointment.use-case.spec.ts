import { AppointmentStatus } from '@src/domain/enums';
import { FindDonorsWithOpenAppointmentUseCase } from '@src/application/use-cases/appointment/find-donors-with-open-appointment.use-case';
import { FakeAppointmentRepository, FakeClock } from '@test/support/fakes';
import { hoursFromNow, oneAppointment } from '@test/support/builders';

describe('FindDonorsWithOpenAppointmentUseCase', () => {
  it('devolve só os doadores informados que têm agendamento em aberto', async () => {
    const appointments = new FakeAppointmentRepository();
    const add = (id: string, donorId: string, partial: Parameters<typeof oneAppointment>[0] = {}) =>
      appointments.appointments.set(id, oneAppointment({ id, donorId, ...partial }));
    add('a1', 'd-aberto', { dateTime: hoursFromNow(48) });
    add('a2', 'd-cancelado', { dateTime: hoursFromNow(48), status: AppointmentStatus.CANCELED });
    add('a3', 'd-passado', { dateTime: hoursFromNow(-72) });
    add('a4', 'd-nao-perguntado', { dateTime: hoursFromNow(48) });

    const result = await new FindDonorsWithOpenAppointmentUseCase(
      appointments,
      new FakeClock(),
    ).execute(['d-aberto', 'd-cancelado', 'd-passado', 'd-aberto']);

    expect(result).toEqual(['d-aberto']);
  });

  it('sem doadores, não consulta nada', async () => {
    const appointments = new FakeAppointmentRepository();
    const spy = jest.spyOn(appointments, 'donorsWithOpenAppointment');

    expect(
      await new FindDonorsWithOpenAppointmentUseCase(appointments, new FakeClock()).execute([]),
    ).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });
});
