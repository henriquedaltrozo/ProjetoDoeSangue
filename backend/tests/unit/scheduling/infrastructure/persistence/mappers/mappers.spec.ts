import { AssessmentNotice } from '@shared/domain/enums';
import { AppointmentStatus, CampaignType } from '@src/domain/enums';
import { Appointment } from '@src/domain/appointment';
import { OutboxEvent, OutboxStatus, OutboxEventType } from '@src/domain/outbox';
import { AppointmentOrmEntity } from '@src/infrastructure/persistence/orm-entities/appointment.orm-entity';
import { CampaignOrmEntity } from '@src/infrastructure/persistence/orm-entities/campaign.orm-entity';
import { OutboxEventOrmEntity } from '@src/infrastructure/persistence/orm-entities/outbox-event.orm-entity';
import { CollectionUnitOrmEntity } from '@src/infrastructure/persistence/orm-entities/collection-unit.orm-entity';
import { AppointmentMapper } from '@src/infrastructure/persistence/mappers/appointment.mapper';
import { CampaignMapper } from '@src/infrastructure/persistence/mappers/campaign.mapper';
import { OutboxEventMapper } from '@src/infrastructure/persistence/mappers/outbox-event.mapper';
import { CollectionUnitMapper } from '@src/infrastructure/persistence/mappers/collection-unit.mapper';

const NOW = new Date('2026-09-10T12:00:00.000Z');

describe('mappers de persistência', () => {
  it('Appointment: ORM -> domínio -> ORM preserva todos os campos', () => {
    const orm = Object.assign(new AppointmentOrmEntity(), {
      id: 'ag-1',
      donorId: 'd-1',
      collectionUnitId: 'u-1',
      campaignId: 'c-1',
      dateTime: NOW,
      status: AppointmentStatus.CONFIRMED,
      assessmentEligibilityId: 'av-1',
      eligibilityNotices: [AssessmentNotice.BRING_GUARDIAN_CONSENT],
      cancellationReason: null,
      confirmedAt: NOW,
      checkinAt: null,
      completedAt: null,
      createdAt: NOW,
      updatedAt: NOW,
    });

    const domain = AppointmentMapper.toDomain(orm);

    expect(domain).toBeInstanceOf(Appointment);
    expect(domain.awaitsAttendance()).toBe(true);
    expect(AppointmentMapper.toOrm(domain)).toEqual(orm);
    expect(AppointmentMapper.toOrm(domain)).toBeInstanceOf(AppointmentOrmEntity);
  });

  it('Appointment: o ORM de um agendamento novo não tem id nem carimbos (nascem no banco)', () => {
    const orm = AppointmentMapper.newToOrm({
      donorId: 'd-1',
      collectionUnitId: 'u-1',
      campaignId: null,
      dateTime: NOW,
      status: AppointmentStatus.SCHEDULED,
    });

    expect(orm).toBeInstanceOf(AppointmentOrmEntity);
    expect(orm.id).toBeUndefined();
    expect(orm.createdAt).toBeUndefined();
    expect(orm.status).toBe(AppointmentStatus.SCHEDULED);
  });

  it('Unidade de coleta: ORM -> domínio -> ORM preserva todos os campos', () => {
    const orm = Object.assign(new CollectionUnitOrmEntity(), {
      id: 'u-1',
      name: 'Central',
      address: 'Rua A',
      neighborhood: 'Centro',
      city: 'Recife',
      uf: 'PE',
      phone: '8130000000',
      simultaneousCapacity: 3,
      operatingHours: { sec: ['08:00-17:00'] },
      active: true,
      createdAt: NOW,
      updatedAt: NOW,
    });

    expect(CollectionUnitMapper.toOrm(CollectionUnitMapper.toDomain(orm))).toEqual(orm);
  });

  it('Campaign: ORM -> domínio -> ORM preserva todos os campos', () => {
    const orm = Object.assign(new CampaignOrmEntity(), {
      id: 'c-1',
      title: 'Campaign',
      description: 'Doe',
      type: CampaignType.URGENT,
      targetBloodType: null,
      collectionUnitId: null,
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      active: true,
      createdAt: NOW,
      updatedAt: NOW,
    });

    expect(CampaignMapper.toOrm(CampaignMapper.toDomain(orm))).toEqual(orm);
  });

  it('Outbox: ORM -> domínio -> ORM preserva todos os campos', () => {
    const orm = Object.assign(new OutboxEventOrmEntity(), {
      id: 'e-1',
      type: OutboxEventType.DONATION_COMPLETED,
      payload: { appointmentId: 'ag-1' },
      status: OutboxStatus.FAILURE,
      attempts: 8,
      reprocessings: 1,
      nextAttemptAt: NOW,
      lastError: 'x',
      createdAt: NOW,
      processedAt: null,
    });

    const domain = OutboxEventMapper.toDomain(orm);

    expect(domain).toBeInstanceOf(OutboxEvent);
    expect(OutboxEventMapper.toOrm(domain)).toEqual(orm);
  });

  it('Outbox: o ORM de um evento novo só leva tipo e payload (o resto vem dos defaults do banco)', () => {
    const orm = OutboxEventMapper.newToOrm({
      type: OutboxEventType.DONATION_COMPLETED,
      payload: { appointmentId: 'ag-1' },
    });

    expect({ ...orm }).toEqual({
      type: OutboxEventType.DONATION_COMPLETED,
      payload: { appointmentId: 'ag-1' },
    });
  });
});
