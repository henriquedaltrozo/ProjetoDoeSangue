import { dayInterval, buildAvailabilityQuery } from '@src/domain/appointment/availability';

describe('availability', () => {
  it('dayInterval cobre o dia inteiro no horário de Brasília', () => {
    expect(dayInterval('2026-09-15')).toEqual({
      start: new Date('2026-09-15T03:00:00.000Z'),
      end: new Date('2026-09-16T02:59:59.999Z'),
    });
  });

  it('buildAvailabilityQuery calcula as vagas livres por horário, sem ficar negativa', () => {
    const result = buildAvailabilityQuery('unit-1', '2026-09-15', 2, [
      { dateTime: new Date('2026-09-15T14:00:00.000Z'), occupied: 1 },
      { dateTime: new Date('2026-09-15T15:00:00.000Z'), occupied: 2 },
      { dateTime: new Date('2026-09-15T16:00:00.000Z'), occupied: 5 },
    ]);

    expect(result).toEqual({
      collectionUnitId: 'unit-1',
      date: '2026-09-15',
      simultaneousCapacity: 2,
      times: [
        { dateTime: '2026-09-15T14:00:00.000Z', occupiedSlots: 1, availableSlots: 1 },
        { dateTime: '2026-09-15T15:00:00.000Z', occupiedSlots: 2, availableSlots: 0 },
        { dateTime: '2026-09-15T16:00:00.000Z', occupiedSlots: 5, availableSlots: 0 },
      ],
    });
  });

  it('sem agendamentos, a lista de horários é vazia', () => {
    expect(buildAvailabilityQuery('u', '2026-09-15', 3, []).times).toEqual([]);
  });
});
