import { Appointment, NewAppointment } from '../../../domain/appointment';
import { AppointmentOrmEntity } from '../orm-entities/appointment.orm-entity';

export const AppointmentMapper = {
  toDomain(orm: AppointmentOrmEntity): Appointment {
    return new Appointment({
      id: orm.id,
      donorId: orm.donorId,
      collectionUnitId: orm.collectionUnitId,
      campaignId: orm.campaignId,
      dateTime: orm.dateTime,
      status: orm.status,
      assessmentEligibilityId: orm.assessmentEligibilityId,
      eligibilityNotices: orm.eligibilityNotices ?? [],
      cancellationReason: orm.cancellationReason,
      confirmedAt: orm.confirmedAt,
      checkinAt: orm.checkinAt,
      completedAt: orm.completedAt,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
      version: orm.version,
    });
  },

  toOrm(appointment: Appointment): AppointmentOrmEntity {
    return Object.assign(new AppointmentOrmEntity(), {
      id: appointment.id,
      donorId: appointment.donorId,
      collectionUnitId: appointment.collectionUnitId,
      campaignId: appointment.campaignId,
      dateTime: appointment.dateTime,
      status: appointment.status,
      assessmentEligibilityId: appointment.assessmentEligibilityId,
      eligibilityNotices: appointment.eligibilityNotices,
      cancellationReason: appointment.cancellationReason,
      confirmedAt: appointment.confirmedAt,
      checkinAt: appointment.checkinAt,
      completedAt: appointment.completedAt,
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt,
      version: appointment.version,
    });
  },

  newToOrm(draft: NewAppointment): AppointmentOrmEntity {
    return Object.assign(new AppointmentOrmEntity(), draft);
  },
};
