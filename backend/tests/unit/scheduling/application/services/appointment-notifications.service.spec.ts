import { AssessmentNotice, NotificationJobType } from '@shared/domain/enums';
import { AppointmentStatus } from '@src/domain/enums';
import { buildAppointmentsEnvironment } from '@test/support/environment';
import { hoursFromNow, oneAppointment } from '@test/support/builders';

describe('AppointmentNotificationsService.schedule', () => {
  const donor = { completeName: 'Fulano', email: 'fulano@x.com' };
  const url = 'http://front/confirm-attendance?token=abc';

  it('com mais de 48 h de antecedência: confirmação na hora, pedido 48 h antes e lembrete 24 h antes, com o link', async () => {
    const env = buildAppointmentsEnvironment();

    await env.notifications.schedule(
      oneAppointment({ dateTime: hoursFromNow(100) }),
      'Unidade Central',
      donor,
    );

    expect(env.publisher.enqueueAppointmentBooked).toHaveBeenCalledWith(
      expect.objectContaining({
        type: NotificationJobType.APPOINTMENT_BOOKED,
        appointmentId: 'appointment-1',
        donorName: 'Fulano',
        recipientEmail: 'fulano@x.com',
        collectionUnitName: 'Unidade Central',
      }),
    );
    const [reminder, delayReminder] = env.publisher.enqueueReminder24H.mock.calls[0];
    const [request, delayRequest] = env.publisher.enqueueAttendanceConfirmation.mock.calls[0];
    expect(reminder.confirmationUrl).toBe(url);
    expect(request.confirmationUrl).toBe(url);
    expect(delayReminder).toBe(76 * 3_600_000);
    expect(delayRequest).toBe(52 * 3_600_000);
  });

  it('entre 24 h e 48 h: o pedido sai na hora e o lembrete continua agendado', async () => {
    const env = buildAppointmentsEnvironment();

    await env.notifications.schedule(oneAppointment({ dateTime: hoursFromNow(36) }), 'U', donor);

    const [, delayRequest] = env.publisher.enqueueAttendanceConfirmation.mock.calls[0];
    const [, delayReminder] = env.publisher.enqueueReminder24H.mock.calls[0];
    expect(delayRequest).toBeLessThanOrEqual(0);
    expect(delayReminder).toBeGreaterThan(0);
  });

  it('com menos de 24 h: só o lembrete (com o link), sem segundo e-mail', async () => {
    const env = buildAppointmentsEnvironment();

    await env.notifications.schedule(oneAppointment({ dateTime: hoursFromNow(10) }), 'U', donor);

    expect(env.publisher.enqueueReminder24H).toHaveBeenCalledTimes(1);
    expect(env.publisher.enqueueAttendanceConfirmation).not.toHaveBeenCalled();
  });

  it('presença já confirmada: lembrete sem o link e sem pedido de confirmação', async () => {
    const env = buildAppointmentsEnvironment();

    await env.notifications.schedule(
      oneAppointment({ status: AppointmentStatus.CONFIRMED, dateTime: hoursFromNow(100) }),
      'U',
      donor,
    );

    expect(env.publisher.enqueueReminder24H.mock.calls[0][0].confirmationUrl).toBeNull();
    expect(env.publisher.enqueueAttendanceConfirmation).not.toHaveBeenCalled();
  });

  it('repete os avisos da avaliação nos e-mails', async () => {
    const env = buildAppointmentsEnvironment();

    await env.notifications.schedule(
      oneAppointment({
        dateTime: hoursFromNow(100),
        eligibilityNotices: [AssessmentNotice.BRING_GUARDIAN_CONSENT],
      }),
      'U',
      donor,
    );

    expect(env.publisher.enqueueReminder24H).toHaveBeenCalledWith(
      expect.objectContaining({ notices: [AssessmentNotice.BRING_GUARDIAN_CONSENT] }),
      expect.any(Number),
    );
  });

  it('falha da fila propaga (o outbox tenta de novo)', async () => {
    const env = buildAppointmentsEnvironment();
    env.publisher.enqueueReminder24H.mockRejectedValue(new Error('redis fora do ar'));

    await expect(
      env.notifications.schedule(oneAppointment({ dateTime: hoursFromNow(100) }), 'U', donor),
    ).rejects.toThrow('redis fora do ar');
  });
});
