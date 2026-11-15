import { AppointmentStatus, CampaignType } from '@src/domain/enums';
import { Role } from '@shared/domain/enums';
import { Actor } from '@shared/application/auth';
import { Appointment, AppointmentProps } from '@src/domain/appointment';
import { Campaign, CampaignProps } from '@src/domain/campaign';
import { OutboxEvent, OutboxEventProps, OutboxStatus, OutboxEventType } from '@src/domain/outbox';
import { CollectionUnit, CollectionUnitProps } from '@src/domain/collection-unit';

/** Instante fixo usado pelos testes (o FakeClock começa nele). */
export const NOW = new Date('2026-09-10T12:00:00.000Z');

export const hoursFromNow = (hours: number): Date => new Date(NOW.getTime() + hours * 3_600_000);

export function donor(donorId: string): Actor {
  return { sub: 'user-1', email: 'donor@example.com', role: Role.DONOR, donorId };
}

export function admin(): Actor {
  return { sub: 'admin-1', email: 'admin@example.com', role: Role.ADMIN };
}

export function oneAppointment(partial: Partial<AppointmentProps> = {}): Appointment {
  return new Appointment({
    id: 'appointment-1',
    donorId: 'donor-1',
    collectionUnitId: 'unit-1',
    campaignId: null,
    dateTime: hoursFromNow(30),
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

export function oneUnit(partial: Partial<CollectionUnitProps> = {}): CollectionUnit {
  return new CollectionUnit({
    id: 'unit-1',
    name: 'Unidade Central',
    address: 'Rua A, 100',
    neighborhood: 'Centro',
    city: 'Recife',
    uf: 'PE',
    phone: '8130000000',
    simultaneousCapacity: 2,
    operatingHours: null,
    active: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...partial,
  });
}

export function oneCampaign(partial: Partial<CampaignProps> = {}): Campaign {
  return new Campaign({
    id: 'campaign-1',
    title: 'Campaign de teste',
    description: 'Doe sangue',
    type: CampaignType.URGENT,
    targetBloodType: null,
    collectionUnitId: null,
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    active: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...partial,
  });
}

export function oneOutboxEvent(partial: Partial<OutboxEventProps> = {}): OutboxEvent {
  return new OutboxEvent({
    id: 'evt-1',
    type: OutboxEventType.DONATION_COMPLETED,
    payload: { appointmentId: 'ag-1', donorId: 'donor-1' },
    status: OutboxStatus.PENDING,
    attempts: 0,
    reprocessings: 0,
    nextAttemptAt: NOW,
    lastError: null,
    createdAt: NOW,
    processedAt: null,
    ...partial,
  });
}
