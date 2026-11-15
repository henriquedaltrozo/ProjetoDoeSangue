import {
  Appointment,
  SLOT_OCCUPYING_STATES,
  NewAppointment,
  OccupancyByTime,
  AvailabilityQuery,
} from '@src/domain/appointment';
import { Campaign, NewCampaign } from '@src/domain/campaign';
import { NewOutboxEvent, OutboxEvent, OutboxStatus } from '@src/domain/outbox';
import { NewCollectionUnit, CollectionUnit } from '@src/domain/collection-unit';
import {
  AppointmentRepository,
  AvailabilityCache,
  CampaignRepository,
  Clock,
  CompletionWithoutEvent,
  TransactionalContext,
  EligibilityGateway,
  AppointmentsFilter,
  LoggerPort,
  NotificationPublisher,
  OutboxRepository,
  CollectionUnitRepository,
  UnitOfWork,
} from '@src/application/ports';
import { NOW } from '@test/support/builders';
import { EligibilityResult } from '@shared/domain/enums';
import { toBusinessDate } from '@shared/domain/time';
import { ConflictError } from '@src/application/errors';

/** Relógio controlável: o tempo só anda quando o teste manda. */
export class FakeClock implements Clock {
  constructor(private current: Date = NOW) {}

  now(): Date {
    return new Date(this.current);
  }

  advanceMs(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export class FakeAppointmentRepository implements AppointmentRepository {
  appointments = new Map<string, Appointment>();
  blocks: string[] = [];
  /** Chamadas feitas enquanto uma transação da FakeUnitOfWork estava aberta. */
  operationsInTransaction: string[] = [];
  saves = 0;
  removed: string[] = [];
  inTransaction = false;
  private sequence = 0;

  private register(operation: string): void {
    if (this.inTransaction) this.operationsInTransaction.push(operation);
  }

  async create(draft: NewAppointment): Promise<Appointment> {
    this.register('create');
    this.sequence += 1;
    const appointment = new Appointment({
      id: `appointment-${this.sequence}`,
      ...draft,
      assessmentEligibilityId: null,
      cancellationReason: null,
      confirmedAt: null,
      checkinAt: null,
      completedAt: null,
      createdAt: NOW,
      updatedAt: NOW,
      version: 1,
    });
    this.appointments.set(appointment.id, appointment);
    return appointment;
  }

  /** Imita o repositório real: grava só se a versão ainda é a lida, e incrementa a versão. */
  async save(appointment: Appointment): Promise<Appointment> {
    this.register('save');
    const stored = this.appointments.get(appointment.id);
    if (stored && stored.version !== appointment.version) {
      throw new ConflictError(
        'O agendamento foi alterado por outra operação. Recarregue e tente de novo.',
      );
    }
    this.saves += 1;
    const saved = new Appointment({ ...appointment, version: appointment.version + 1 });
    this.appointments.set(appointment.id, saved);
    return saved;
  }

  async remove(id: string): Promise<void> {
    this.removed.push(id);
    this.appointments.delete(id);
  }

  /** Devolve uma cópia, como o banco: alterações só valem depois de `save`. */
  async findById(id: string): Promise<Appointment | null> {
    const stored = this.appointments.get(id);
    return stored ? new Appointment({ ...stored }) : null;
  }

  async listByDonor(donorId: string): Promise<Appointment[]> {
    return [...this.appointments.values()]
      .filter((a) => a.donorId === donorId)
      .sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime());
  }

  receivedFilters: AppointmentsFilter[] = [];

  async list(filter: AppointmentsFilter): Promise<Appointment[]> {
    this.receivedFilters.push(filter);
    return [...this.appointments.values()].filter(
      (a) =>
        (!filter.status || a.status === filter.status) &&
        (!filter.collectionUnitId || a.collectionUnitId === filter.collectionUnitId) &&
        (!filter.period || (a.dateTime >= filter.period.start && a.dateTime <= filter.period.end)),
    );
  }

  async listUpcomingByUnit(collectionUnitId: string, now: Date): Promise<Appointment[]> {
    return [...this.appointments.values()]
      .filter(
        (a) =>
          a.collectionUnitId === collectionUnitId &&
          a.awaitsAttendanceOrScheduled() &&
          a.businessDay() >= toBusinessDate(now),
      )
      .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());
  }

  async countOccupied(collectionUnitId: string, dateTime: Date): Promise<number> {
    this.register('countOccupied');
    return [...this.appointments.values()].filter(
      (a) =>
        a.collectionUnitId === collectionUnitId &&
        a.dateTime.getTime() === dateTime.getTime() &&
        SLOT_OCCUPYING_STATES.includes(a.status),
    ).length;
  }

  async countOccupancyByTime(
    collectionUnitId: string,
    start: Date,
    end: Date,
  ): Promise<OccupancyByTime[]> {
    const byTime = new Map<number, number>();
    for (const a of this.appointments.values()) {
      if (
        a.collectionUnitId === collectionUnitId &&
        a.dateTime >= start &&
        a.dateTime <= end &&
        a.occupiesSlot()
      ) {
        byTime.set(a.dateTime.getTime(), (byTime.get(a.dateTime.getTime()) ?? 0) + 1);
      }
    }
    return [...byTime].map(([ms, occupied]) => ({ dateTime: new Date(ms), occupied }));
  }

  async blockTime(collectionUnitId: string, dateTime: Date): Promise<void> {
    this.register('blockTime');
    this.blocks.push(`${collectionUnitId}:${dateTime.toISOString()}`);
  }

  async blockDonor(donorId: string): Promise<void> {
    this.register('blockDonor');
    this.blocks.push(`donor:${donorId}`);
  }

  async countOpenByDonor(donorId: string, now: Date): Promise<number> {
    this.register('countOpenByDonor');
    return [...this.appointments.values()].filter(
      (a) => a.donorId === donorId && a.isOpenForDonor(now),
    ).length;
  }

  async donorsWithOpenAppointment(donorIds: string[], now: Date): Promise<string[]> {
    const open = [...this.appointments.values()].filter(
      (a) => donorIds.includes(a.donorId) && a.isOpenForDonor(now),
    );
    return [...new Set(open.map((a) => a.donorId))];
  }
}

export class FakeOutboxRepository implements OutboxRepository {
  events = new Map<string, OutboxEvent>();
  operationsInTransaction: string[] = [];
  inTransaction = false;
  receivedBatchLimit?: number;
  firstEvent: Date | null = null;
  completionsWithoutEvent: CompletionWithoutEvent[] = [];
  completionsQuery?: { since: Date; windowDays: number };
  reactivated = 0;
  permanentFailures = 0;
  reprocessingLimits: number[] = [];
  private sequence = 0;

  private register(operation: string): void {
    if (this.inTransaction) this.operationsInTransaction.push(operation);
  }

  async create(draft: NewOutboxEvent): Promise<OutboxEvent> {
    this.register('create');
    this.sequence += 1;
    const event = new OutboxEvent({
      id: `event-${this.sequence}`,
      ...draft,
      status: OutboxStatus.PENDING,
      attempts: 0,
      reprocessings: 0,
      nextAttemptAt: NOW,
      lastError: null,
      createdAt: NOW,
      processedAt: null,
    });
    this.events.set(event.id, event);
    return event;
  }

  async save(event: OutboxEvent): Promise<OutboxEvent> {
    this.register('save');
    this.events.set(event.id, event);
    return event;
  }

  receivedLease: Date | null = null;

  async claimPending(limit: number, leaseUntil: Date): Promise<OutboxEvent[]> {
    this.register('claimPending');
    this.receivedBatchLimit = limit;
    this.receivedLease = leaseUntil;
    return [...this.events.values()]
      .filter((e) => e.status === OutboxStatus.PENDING)
      .slice(0, limit);
  }

  async listFailures(limit: number): Promise<OutboxEvent[]> {
    return [...this.events.values()]
      .filter((e) => e.status === OutboxStatus.FAILURE)
      .slice(0, limit);
  }

  async findFailureById(id: string): Promise<OutboxEvent | null> {
    const event = this.events.get(id);
    return event?.status === OutboxStatus.FAILURE ? event : null;
  }

  async reactivateFailuresExpired(maxReprocessings: number): Promise<number> {
    this.reprocessingLimits.push(maxReprocessings);
    return this.reactivated;
  }

  async countPermanentFailures(maxReprocessings: number): Promise<number> {
    this.reprocessingLimits.push(maxReprocessings);
    return this.permanentFailures;
  }

  async purgeProcessed(before: Date): Promise<number> {
    let purged = 0;
    for (const [id, event] of this.events) {
      if (
        event.status === OutboxStatus.PROCESSED &&
        event.processedAt &&
        event.processedAt < before
      ) {
        this.events.delete(id);
        purged += 1;
      }
    }
    return purged;
  }

  async findFirstEventDate(): Promise<Date | null> {
    return this.firstEvent;
  }

  async listCompletionsWithoutEvent(
    since: Date,
    windowDays: number,
  ): Promise<CompletionWithoutEvent[]> {
    this.completionsQuery = { since, windowDays };
    return this.completionsWithoutEvent;
  }
}

export class FakeCollectionUnitRepository implements CollectionUnitRepository {
  units = new Map<string, CollectionUnit>();
  private sequence = 0;

  add(unit: CollectionUnit): CollectionUnit {
    this.units.set(unit.id, unit);
    return unit;
  }

  async create(draft: NewCollectionUnit): Promise<CollectionUnit> {
    this.sequence += 1;
    return this.add(
      new CollectionUnit({
        id: `unit-${this.sequence}`,
        ...draft,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    );
  }

  async save(unit: CollectionUnit): Promise<CollectionUnit> {
    return this.add(unit);
  }

  async findById(id: string): Promise<CollectionUnit | null> {
    return this.units.get(id) ?? null;
  }

  async listActive(): Promise<CollectionUnit[]> {
    return (await this.listAll()).filter((u) => u.active);
  }

  async listAll(): Promise<CollectionUnit[]> {
    return [...this.units.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
}

export class FakeCampaignRepository implements CampaignRepository {
  campaigns = new Map<string, Campaign>();
  private sequence = 0;

  add(campaign: Campaign): Campaign {
    this.campaigns.set(campaign.id, campaign);
    return campaign;
  }

  async create(draft: NewCampaign): Promise<Campaign> {
    this.sequence += 1;
    return this.add(
      new Campaign({
        id: `campaign-${this.sequence}`,
        ...draft,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    );
  }

  async save(campaign: Campaign): Promise<Campaign> {
    return this.add(campaign);
  }

  async findById(id: string): Promise<Campaign | null> {
    return this.campaigns.get(id) ?? null;
  }

  async listActive(todayISO: string): Promise<Campaign[]> {
    return [...this.campaigns.values()].filter((c) => c.active && c.endDate >= todayISO);
  }
}

/**
 * Unidade de trabalho em memória: marca os repositórios como "em transação"
 * durante o trabalho e, se ele lançar, desfaz o que foi gravado (rollback).
 */
export class FakeUnitOfWork implements UnitOfWork {
  transactions = 0;

  constructor(
    private readonly appointments: FakeAppointmentRepository,
    private readonly outbox: FakeOutboxRepository,
    private readonly campaigns: FakeCampaignRepository = new FakeCampaignRepository(),
  ) {}

  async run<T>(work: (tx: TransactionalContext) => Promise<T>): Promise<T> {
    this.transactions += 1;
    const appointmentsBefore = new Map(this.appointments.appointments);
    const eventsBefore = new Map(this.outbox.events);
    const campaignsBefore = new Map(this.campaigns.campaigns);
    this.appointments.inTransaction = true;
    this.outbox.inTransaction = true;
    try {
      return await work({
        appointments: this.appointments,
        campaigns: this.campaigns,
        outbox: this.outbox,
      });
    } catch (err) {
      this.appointments.appointments = appointmentsBefore;
      this.outbox.events = eventsBefore;
      this.campaigns.campaigns = campaignsBefore;
      throw err;
    } finally {
      this.appointments.inTransaction = false;
      this.outbox.inTransaction = false;
    }
  }
}

export class FakeAvailabilityCache implements AvailabilityCache {
  entries = new Map<string, AvailabilityQuery>();
  invalidations: string[] = [];
  writes: { key: string; ttlSeconds: number }[] = [];

  async get(collectionUnitId: string, dataISO: string): Promise<AvailabilityQuery | null> {
    return this.entries.get(`${collectionUnitId}:${dataISO}`) ?? null;
  }

  async store(
    collectionUnitId: string,
    dataISO: string,
    query: AvailabilityQuery,
    ttlSeconds: number,
  ): Promise<void> {
    const key = `${collectionUnitId}:${dataISO}`;
    this.entries.set(key, query);
    this.writes.push({ key, ttlSeconds });
  }

  async invalidateDay(collectionUnitId: string, dateTime: Date): Promise<void> {
    const key = `${collectionUnitId}:${dateTime.toISOString().slice(0, 10)}`;
    this.invalidations.push(key);
    this.entries.delete(key);
  }
}

export function createEligibilityGateway() {
  return {
    // Padrão: apto (os testes que precisam de outro resultado sobrescrevem).
    assessInternal: jest.fn().mockResolvedValue({
      id: 'assessment-default',
      result: EligibilityResult.ELIGIBLE,
      reasons: [],
      notices: [],
      nextEligibilityDate: null,
    }),
    completeDonation: jest.fn(),
    listContactsByBloodType: jest.fn().mockResolvedValue([]),
    findDonorContact: jest.fn().mockResolvedValue({
      id: 'donor-1',
      completeName: 'Fulano',
      email: 'fulano@x.com',
      active: true,
    }),
  } satisfies Record<keyof EligibilityGateway, jest.Mock>;
}

export function createNotificationPublisher() {
  return {
    enqueueReminder24H: jest.fn().mockResolvedValue(undefined),
    enqueueAttendanceConfirmation: jest.fn().mockResolvedValue(undefined),
    enqueueIntervalCompleted: jest.fn().mockResolvedValue(undefined),
    enqueueUrgentCampaign: jest.fn().mockResolvedValue(undefined),
    enqueueAppointmentBooked: jest.fn().mockResolvedValue(undefined),
    enqueueAppointmentCanceled: jest.fn().mockResolvedValue(undefined),
    enqueueNoShow: jest.fn().mockResolvedValue(undefined),
    cancelReminder24H: jest.fn().mockResolvedValue(undefined),
    cancelAttendanceConfirmation: jest.fn().mockResolvedValue(undefined),
    removeReminderLink24h: jest.fn().mockResolvedValue(undefined),
  } satisfies Record<keyof NotificationPublisher, jest.Mock>;
}

export function createLogger() {
  return { warn: jest.fn(), error: jest.fn() } satisfies Record<keyof LoggerPort, jest.Mock>;
}
