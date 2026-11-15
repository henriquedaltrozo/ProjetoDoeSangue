import { CancelDonorAppointmentsUseCase } from '@src/application/use-cases/appointment/cancel-donor-appointments.use-case';
import { CancelAppointmentUseCase } from '@src/application/use-cases/appointment/cancel-appointment.use-case';
import { CompleteAppointmentUseCase } from '@src/application/use-cases/appointment/complete-appointment.use-case';
import { ConfirmAttendanceByTokenUseCase } from '@src/application/use-cases/appointment/confirm-attendance-by-token.use-case';
import { ConfirmAttendanceUseCase } from '@src/application/use-cases/appointment/confirm-attendance.use-case';
import { CheckAvailabilityUseCase } from '@src/application/use-cases/appointment/check-availability.use-case';
import { CreateAppointmentUseCase } from '@src/application/use-cases/appointment/create-appointment.use-case';
import { ListAppointmentsUseCase } from '@src/application/use-cases/appointment/list-appointments.use-case';
import { MarkNoShowUseCase } from '@src/application/use-cases/appointment/mark-no-show.use-case';
import { PerformCheckinUseCase } from '@src/application/use-cases/appointment/perform-checkin.use-case';
import { AttendanceConfirmationService } from '@src/application/services/attendance-confirmation.service';
import { AppointmentNotificationsService } from '@src/application/services/appointment-notifications.service';
import {
  FakeAppointmentRepository,
  FakeAvailabilityCache,
  FakeCampaignRepository,
  FakeClock,
  FakeOutboxRepository,
  FakeCollectionUnitRepository,
  FakeUnitOfWork,
  createEligibilityGateway,
  createLogger,
  createNotificationPublisher,
} from '@test/support/fakes';

/** Monta os casos de uso de agendamento sobre fakes em memória das portas. */
export function buildAppointmentsEnvironment() {
  const clock = new FakeClock();
  const appointments = new FakeAppointmentRepository();
  const outbox = new FakeOutboxRepository();
  const units = new FakeCollectionUnitRepository();
  const campaigns = new FakeCampaignRepository();
  const unitOfWork = new FakeUnitOfWork(appointments, outbox, campaigns);
  const cache = new FakeAvailabilityCache();
  const eligibility = createEligibilityGateway();
  const publisher = createNotificationPublisher();
  const logger = createLogger();
  const tokens = {
    buildUrl: jest.fn().mockReturnValue('http://front/confirm-attendance?token=abc'),
    verify: jest.fn(),
  };

  const notifications = new AppointmentNotificationsService(publisher, tokens, clock, logger);
  const confirmation = new AttendanceConfirmationService(appointments, clock, notifications);

  return {
    clock,
    appointments,
    outbox,
    units,
    campaigns,
    unitOfWork,
    cache,
    eligibility,
    publisher,
    notifications,
    logger,
    tokens,
    create: new CreateAppointmentUseCase(
      appointments,
      units,
      campaigns,
      unitOfWork,
      eligibility,
      cache,
      clock,
    ),
    cancel: new CancelAppointmentUseCase(appointments, cache, clock, notifications, unitOfWork),
    cancelDonorAppointments: new CancelDonorAppointmentsUseCase(
      appointments,
      cache,
      clock,
      notifications,
    ),
    checkin: new PerformCheckinUseCase(appointments, eligibility, clock),
    complete: new CompleteAppointmentUseCase(appointments, unitOfWork, cache, clock),
    noShow: new MarkNoShowUseCase(appointments, cache, clock, notifications, unitOfWork),
    confirmAttendance: new ConfirmAttendanceUseCase(appointments, confirmation),
    confirmByToken: new ConfirmAttendanceByTokenUseCase(appointments, tokens, confirmation),
    availability: new CheckAvailabilityUseCase(units, appointments, cache),
    list: new ListAppointmentsUseCase(appointments),
  };
}

export type AppointmentsEnvironment = ReturnType<typeof buildAppointmentsEnvironment>;
