import { InvalidValueError } from '@src/domain/errors';
import { NotFoundError } from '@src/application/errors';
import { FakeCollectionUnitRepository } from '@test/support/fakes';
import { hoursFromNow, oneAppointment, oneUnit } from '@test/support/builders';
import { FindCollectionUnitUseCase } from '@src/application/use-cases/collection-unit/find-collection-unit.use-case';
import { CreateCollectionUnitUseCase } from '@src/application/use-cases/collection-unit/create-collection-unit.use-case';
import {
  DeactivateCollectionUnitUseCase,
  UNIT_DEACTIVATED_REASON,
} from '@src/application/use-cases/collection-unit/deactivate-collection-unit.use-case';
import { AppointmentStatus } from '@src/domain/enums';
import { buildAppointmentsEnvironment } from '@test/support/environment';
import { ListActiveUnitsUseCase } from '@src/application/use-cases/collection-unit/list-active-units.use-case';
import { ListUnitsUseCase } from '@src/application/use-cases/collection-unit/list-units.use-case';
import { ReactivateCollectionUnitUseCase } from '@src/application/use-cases/collection-unit/reactivate-collection-unit.use-case';

describe('casos de uso de unidades de coleta', () => {
  let repo: FakeCollectionUnitRepository;

  beforeEach(() => {
    repo = new FakeCollectionUnitRepository();
    repo.add(oneUnit({ id: 'unit-b', name: 'B - Norte', active: true }));
    repo.add(oneUnit({ id: 'unit-a', name: 'A - Sul', active: false }));
  });

  it('cria uma unidade ativa, com horário de funcionamento nulo por padrão', async () => {
    const unit = await new CreateCollectionUnitUseCase(repo).execute({
      name: 'Unidade Nova',
      address: 'Rua B, 200',
      neighborhood: 'Centro',
      city: 'Olinda',
      uf: 'PE',
      phone: '8130001111',
      simultaneousCapacity: 4,
    });

    expect(unit).toMatchObject({
      name: 'Unidade Nova',
      active: true,
      operatingHours: null,
    });
    expect(repo.units.get(unit.id)).toMatchObject(unit);
    expect(unit).not.toBe(repo.units.get(unit.id)); // output é cópia, não a entidade
  });

  it('rejeita capacidade menor que 1', async () => {
    await expect(
      new CreateCollectionUnitUseCase(repo).execute({
        name: 'Unidade Nova',
        address: 'Rua B, 200',
        neighborhood: 'Centro',
        city: 'Olinda',
        uf: 'PE',
        phone: '8130001111',
        simultaneousCapacity: 0,
      }),
    ).rejects.toBeInstanceOf(InvalidValueError);
  });

  it('lista apenas unidades ativas por padrão', async () => {
    const units = await new ListActiveUnitsUseCase(repo).execute();

    expect(units.map((u) => u.id)).toEqual(['unit-b']);
  });

  describe('ListUnitsUseCase', () => {
    it('busca todas as unidades (ativas e inativas), por nome, quando includeInactive é true', async () => {
      const units = await new ListUnitsUseCase(repo).execute(true);

      expect(units.map((u) => u.id)).toEqual(['unit-a', 'unit-b']);
    });

    it('busca apenas ativas quando includeInactive é false', async () => {
      const units = await new ListUnitsUseCase(repo).execute(false);

      expect(units.map((u) => u.id)).toEqual(['unit-b']);
    });
  });

  it('lança NotFoundError ao buscar uma unidade inexistente', async () => {
    await expect(new FindCollectionUnitUseCase(repo).execute('not-exists')).rejects.toThrow(
      new NotFoundError('Unidade de coleta não encontrada.'),
    );
  });

  describe('DeactivateCollectionUnitUseCase', () => {
    it('desativa a unidade e cancela os agendamentos dela de hoje em diante, sem check-in', async () => {
      const env = buildAppointmentsEnvironment();
      env.units.add(oneUnit({ id: 'unit-b' }));
      const add = (id: string, partial: Parameters<typeof oneAppointment>[0]) =>
        env.appointments.appointments.set(
          id,
          oneAppointment({ id, collectionUnitId: 'unit-b', ...partial }),
        );
      add('futuro', { dateTime: hoursFromNow(30) });
      // Hoje, com o horário já passado: o doador atrasado ainda poderia fazer check-in.
      add('hoje-passado', { dateTime: hoursFromNow(-2) });
      add('ontem', { dateTime: hoursFromNow(-24) });
      add('checkin', { status: AppointmentStatus.CHECKIN_PERFORMED });
      env.appointments.appointments.set(
        'outra',
        oneAppointment({ id: 'outra', collectionUnitId: 'unit-x' }),
      );

      const unit = await new DeactivateCollectionUnitUseCase(
        env.units,
        env.appointments,
        env.cache,
        env.clock,
        env.notifications,
        env.unitOfWork,
      ).execute('unit-b');

      expect(unit.active).toBe(false);
      const status = (id: string) => env.appointments.appointments.get(id)?.status;
      expect(status('futuro')).toBe(AppointmentStatus.CANCELED);
      expect(env.appointments.appointments.get('futuro')?.cancellationReason).toBe(
        UNIT_DEACTIVATED_REASON,
      );
      expect(status('hoje-passado')).toBe(AppointmentStatus.CANCELED);
      expect(status('ontem')).toBe(AppointmentStatus.ELIGIBILITY_CONFIRMED);
      expect(status('checkin')).toBe(AppointmentStatus.CHECKIN_PERFORMED);
      expect(status('outra')).toBe(AppointmentStatus.ELIGIBILITY_CONFIRMED);
      expect(env.publisher.cancelReminder24H).toHaveBeenCalledWith('futuro');
      // Cada cancelamento gera, na mesma transação, o evento do aviso ao doador.
      expect([...env.outbox.events.values()].map((e) => e.payload)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            appointmentId: 'futuro',
            reason: UNIT_DEACTIVATED_REASON,
            canceledByStaff: true,
          }),
        ]),
      );
    });
  });

  describe('ReactivateCollectionUnitUseCase', () => {
    it('reativa uma unidade desativada', async () => {
      const unit = await new ReactivateCollectionUnitUseCase(repo).execute('unit-a');

      expect(unit.active).toBe(true);
      expect(repo.units.get('unit-a')?.active).toBe(true);
    });

    it('lança NotFoundError ao reativar uma unidade inexistente', async () => {
      await expect(
        new ReactivateCollectionUnitUseCase(repo).execute('not-exists'),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
