import { AssessmentNotice } from '@shared/domain/enums';
import { AppointmentStatus, CampaignType } from '@src/domain/enums';
import {
  createTestDatabase,
  pendingSchemaChanges,
  TestDatabase,
} from '@shared/testing/test-database';
import { ConflictError } from '@src/application/errors';
import { Appointment } from '@src/domain/appointment';
import { Campaign } from '@src/domain/campaign';
import { CollectionUnit } from '@src/domain/collection-unit';
import { OutboxEvent, OutboxEventType, OutboxStatus } from '@src/domain/outbox';
import { MIGRATIONS } from '@src/infrastructure/persistence/migrations';
import { AppointmentOrmEntity } from '@src/infrastructure/persistence/orm-entities/appointment.orm-entity';
import { ORM_ENTITIES } from '@src/infrastructure/persistence/orm-entities';
import { CampaignOrmEntity } from '@src/infrastructure/persistence/orm-entities/campaign.orm-entity';
import { CollectionUnitOrmEntity } from '@src/infrastructure/persistence/orm-entities/collection-unit.orm-entity';
import { OutboxEventOrmEntity } from '@src/infrastructure/persistence/orm-entities/outbox-event.orm-entity';
import { TypeOrmUnitOfWork } from '@src/infrastructure/persistence/typeorm-unit-of-work';
import { AppointmentTypeOrmRepository } from '@src/infrastructure/persistence/repositories/appointment.typeorm-repository';
import { CampaignTypeOrmRepository } from '@src/infrastructure/persistence/repositories/campaign.typeorm-repository';
import { CollectionUnitTypeOrmRepository } from '@src/infrastructure/persistence/repositories/collection-unit.typeorm-repository';
import { OutboxTypeOrmRepository } from '@src/infrastructure/persistence/repositories/outbox.typeorm-repository';

/** Integração com Postgres real (migrations de produção aplicadas em um banco descartável). */
describe('repositórios de scheduling (Postgres)', () => {
  let db: TestDatabase;
  let units: CollectionUnitTypeOrmRepository;
  let campaigns: CampaignTypeOrmRepository;
  let appointments: AppointmentTypeOrmRepository;
  let outbox: OutboxTypeOrmRepository;

  const DONOR = '11111111-1111-4111-8111-111111111111';
  // Horas cheias: os agendamentos seguem a grade de 30 em 30 minutos.
  const futureHour = (hours: number) =>
    new Date((Math.ceil(Date.now() / 3_600_000) + hours) * 3_600_000);

  beforeAll(async () => {
    db = await createTestDatabase({
      schema: 'scheduling',
      entities: ORM_ENTITIES,
      migrations: MIGRATIONS,
    });
    const ds = db.dataSource;
    units = new CollectionUnitTypeOrmRepository(ds.getRepository(CollectionUnitOrmEntity));
    campaigns = new CampaignTypeOrmRepository(ds.getRepository(CampaignOrmEntity));
    appointments = new AppointmentTypeOrmRepository(ds.getRepository(AppointmentOrmEntity));
    outbox = new OutboxTypeOrmRepository(ds.getRepository(OutboxEventOrmEntity));
  });

  afterAll(() => db?.destroy());
  beforeEach(() => db.truncate());

  /** Eventos vencidos agora (reserva com prazo "já", para não tirá-los da fila nos próximos passos). */
  const pendingInTransaction = (limit = 10) => outbox.claimPending(limit, new Date());

  const newUnit = (capacity = 2) =>
    units.create(
      CollectionUnit.draft({
        name: 'Hemocentro',
        address: 'Rua A, 1',
        neighborhood: 'Centro',
        city: 'Recife',
        uf: 'PE',
        phone: '8130000000',
        simultaneousCapacity: capacity,
      }),
    );

  describe('unidades de coleta', () => {
    it('cria, busca, desativa e lista só as ativas', async () => {
      const unit = await newUnit();
      expect(unit.id).toBeDefined();
      expect(unit.active).toBe(true);
      expect((await units.findById(unit.id))?.name).toBe('Hemocentro');

      unit.deactivate();
      await units.save(unit);

      expect(await units.listActive()).toHaveLength(0);
      expect(await units.listAll()).toHaveLength(1);
    });

    it('findById devolve null para id inexistente', async () => {
      expect(await units.findById('00000000-0000-4000-8000-000000000000')).toBeNull();
    });
  });

  it('as migrations criam exatamente o schema das entidades', async () => {
    expect(await pendingSchemaChanges(db.dataSource)).toEqual([]);
  });

  describe('campanhas', () => {
    it('cria e lista só as ativas, da mais recente para a mais antiga', async () => {
      const older = await campaigns.create(
        Campaign.draft({
          title: 'Antiga',
          description: 'd',
          type: CampaignType.REGULAR,
          startDate: '2026-01-01',
          endDate: '2026-02-01',
        }),
      );
      await campaigns.create(
        Campaign.draft({
          title: 'Nova',
          description: 'd',
          type: CampaignType.URGENT,
          startDate: '2026-06-01',
          endDate: '2026-07-01',
        }),
      );
      older.deactivate();
      await campaigns.save(older);

      const active = await campaigns.listActive('2026-06-15');
      expect(active.map((c) => c.title)).toEqual(['Nova']);
      // Depois do fim, a campanha ativa deixa de ser listada.
      expect(await campaigns.listActive('2026-07-02')).toEqual([]);
    });
  });

  describe('agendamentos', () => {
    it('cria SCHEDULED, persiste a transição de estado e lista por doador', async () => {
      const unit = await newUnit();
      const when = futureHour(48);
      const created = await appointments.create(
        Appointment.draft(
          { donorId: DONOR, collectionUnitId: unit.id, dateTime: when },
          new Date(),
        ),
      );
      expect(created.status).toBe(AppointmentStatus.SCHEDULED);

      created.registerEligibilityAssessment('22222222-2222-4222-8222-222222222222', true, [
        AssessmentNotice.BRING_GUARDIAN_CONSENT,
      ]);
      await appointments.save(created);

      const loaded = await appointments.findById(created.id);
      expect(loaded?.status).toBe(AppointmentStatus.ELIGIBILITY_CONFIRMED);
      expect(loaded?.assessmentEligibilityId).toBe('22222222-2222-4222-8222-222222222222');
      expect(loaded?.eligibilityNotices).toEqual([AssessmentNotice.BRING_GUARDIAN_CONSENT]);
      expect(await appointments.listByDonor(DONOR)).toHaveLength(1);
    });

    it('countOccupied só conta agendamentos que ocupam vaga no horário', async () => {
      const unit = await newUnit(2);
      const when = futureHour(72);
      const make = () =>
        appointments.create(
          Appointment.draft(
            { donorId: DONOR, collectionUnitId: unit.id, dateTime: when },
            new Date(),
          ),
        );
      const a = await make();
      await make();
      expect(await appointments.countOccupied(unit.id, when)).toBe(2);

      a.cancel(new Date(), false, 'desisti');
      await appointments.save(a);

      expect(await appointments.countOccupied(unit.id, when)).toBe(1);
    });

    it('donorsWithOpenAppointment devolve só os doadores informados com agendamento em aberto', async () => {
      const unit = await newUnit(5);
      const other = '22222222-2222-4222-8222-222222222222';
      const nobody = '33333333-3333-4333-8333-333333333333';
      await appointments.create(
        Appointment.draft(
          { donorId: DONOR, collectionUnitId: unit.id, dateTime: futureHour(30) },
          new Date(),
        ),
      );
      const canceled = await appointments.create(
        Appointment.draft(
          { donorId: other, collectionUnitId: unit.id, dateTime: futureHour(30) },
          new Date(),
        ),
      );
      canceled.cancel(new Date(), false, 'desisti');
      await appointments.save(canceled);

      expect(
        await appointments.donorsWithOpenAppointment([DONOR, other, nobody], new Date()),
      ).toEqual([DONOR]);
      expect(await appointments.donorsWithOpenAppointment([], new Date())).toEqual([]);
    });

    it('listUpcomingByUnit traz só os da unidade de hoje em diante e antes do check-in', async () => {
      const unit = await newUnit(5);
      const other = await newUnit(5);
      const make = (collectionUnitId: string, hours: number) =>
        appointments.create(
          Appointment.draft(
            { donorId: DONOR, collectionUnitId, dateTime: futureHour(hours) },
            new Date(),
          ),
        );
      const upcoming = await make(unit.id, 30);
      const canceled = await make(unit.id, 40);
      canceled.cancel(new Date(), false, 'desisti');
      await appointments.save(canceled);
      await make(other.id, 30);

      expect((await appointments.listUpcomingByUnit(unit.id, new Date())).map((a) => a.id)).toEqual(
        [upcoming.id],
      );
      // Três dias depois, o de 30 h já é de um dia passado (e o de 40 h foi cancelado).
      const later = new Date(Date.now() + 72 * 3_600_000);
      expect(await appointments.listUpcomingByUnit(unit.id, later)).toEqual([]);
    });

    it('remove apaga o agendamento', async () => {
      const unit = await newUnit();
      const created = await appointments.create(
        Appointment.draft(
          { donorId: DONOR, collectionUnitId: unit.id, dateTime: futureHour(30) },
          new Date(),
        ),
      );
      await appointments.remove(created.id);
      expect(await appointments.findById(created.id)).toBeNull();
    });

    it('concorrência otimista: a segunda gravação de uma leitura antiga falha e não sobrescreve', async () => {
      const unit = await newUnit();
      const created = await appointments.create(
        Appointment.draft(
          { donorId: DONOR, collectionUnitId: unit.id, dateTime: futureHour(30) },
          new Date(),
        ),
      );
      created.registerEligibilityAssessment('22222222-2222-4222-8222-222222222222', true);
      const confirmed = await appointments.save(created);
      expect(confirmed.version).toBe(created.version + 1);

      const readByA = await appointments.findById(created.id);
      const readByB = await appointments.findById(created.id);
      readByA?.cancel(new Date(), false, 'A cancelou');
      readByB?.makeCheckin(created.dateTime);

      await appointments.save(readByA as Appointment);
      await expect(appointments.save(readByB as Appointment)).rejects.toBeInstanceOf(ConflictError);
      expect((await appointments.findById(created.id))?.status).toBe(AppointmentStatus.CANCELED);
    });
  });

  describe('outbox', () => {
    const draft = () => ({
      type: OutboxEventType.DONATION_COMPLETED,
      payload: { appointmentId: 'a1', donorId: 'd1' } as Record<string, unknown>,
    });

    it('cria PENDING, guarda o payload e o encontra com lock', async () => {
      const event = await outbox.create(draft());
      expect(event.status).toBe(OutboxStatus.PENDING);

      const pending = await pendingInTransaction();
      expect(pending.map((e) => e.id)).toEqual([event.id]);
      expect(pending[0].payload).toEqual({ appointmentId: 'a1', donorId: 'd1' });
    });

    it('falhas definitivas aparecem em listFailures e saem de pending', async () => {
      const event = await outbox.create(draft());
      const now = new Date();
      for (let i = 0; i < 50 && event.status !== OutboxStatus.FAILURE; i++) {
        event.registerFailure('boom', now);
      }
      await outbox.save(event);

      expect(await pendingInTransaction()).toHaveLength(0);
      const failures = await outbox.listFailures(10);
      expect(failures).toHaveLength(1);
      expect(failures[0].lastError).toBe('boom');
      expect((await outbox.findFailureById(event.id))?.id).toBe(event.id);
    });
  });

  describe('unit of work', () => {
    it('é atômico: se o trabalho falha, nem o agendamento nem o evento persistem', async () => {
      const unit = await newUnit();
      const uow = new TypeOrmUnitOfWork(db.dataSource);

      await expect(
        uow.run(async (tx) => {
          await tx.appointments.create(
            Appointment.draft(
              { donorId: DONOR, collectionUnitId: unit.id, dateTime: futureHour(40) },
              new Date(),
            ),
          );
          await tx.outbox.create({
            type: OutboxEventType.DONATION_COMPLETED,
            payload: {},
          });
          throw new Error('falha no meio');
        }),
      ).rejects.toThrow('falha no meio');

      expect(await appointments.listByDonor(DONOR)).toHaveLength(0);
      expect(await pendingInTransaction()).toHaveLength(0);
    });

    it('confirma os dois quando o trabalho termina bem', async () => {
      const unit = await newUnit();
      const uow = new TypeOrmUnitOfWork(db.dataSource);

      await uow.run(async (tx) => {
        await tx.appointments.create(
          Appointment.draft(
            { donorId: DONOR, collectionUnitId: unit.id, dateTime: futureHour(40) },
            new Date(),
          ),
        );
        await tx.outbox.create({ type: OutboxEventType.DONATION_COMPLETED, payload: {} });
      });

      expect(await appointments.listByDonor(DONOR)).toHaveLength(1);
      expect(await pendingInTransaction()).toHaveLength(1);
    });
  });

  it('o evento reconhecido como OutboxEvent tem comportamento de domínio', async () => {
    const event = await outbox.create({
      type: OutboxEventType.DONATION_COMPLETED,
      payload: {},
    });
    expect(event).toBeInstanceOf(OutboxEvent);
  });
});
