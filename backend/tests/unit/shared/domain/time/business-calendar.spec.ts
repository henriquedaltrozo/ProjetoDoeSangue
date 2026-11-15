import { ageOn, businessDayInterval, toBusinessDate } from '@src/domain/time';

describe('calendário do negócio (fuso de Brasília)', () => {
  it('a data de calendário segue Brasília, não UTC', () => {
    // 22h de 10/10 em Brasília = 01h de 11/10 em UTC.
    expect(toBusinessDate(new Date('2026-10-11T01:00:00Z'))).toBe('2026-10-10');
    expect(toBusinessDate(new Date('2026-10-11T03:00:00Z'))).toBe('2026-10-11');
  });

  it('o dia vai da meia-noite à meia-noite de Brasília', () => {
    expect(businessDayInterval('2026-10-10')).toEqual({
      start: new Date('2026-10-10T03:00:00.000Z'),
      end: new Date('2026-10-11T02:59:59.999Z'),
    });
  });

  it('a idade só muda no dia do aniversário em Brasília', () => {
    // véspera às 15h e às 22h em Brasília: ainda 17 anos
    expect(ageOn('2008-10-29', new Date('2026-10-28T18:00:00Z'))).toBe(17);
    expect(ageOn('2008-10-29', new Date('2026-10-29T01:00:00Z'))).toBe(17);
    // no dia do aniversário
    expect(ageOn('2008-10-29', new Date('2026-10-29T03:00:00Z'))).toBe(18);
  });

  it('nascido em 29/02 completa ano em 01/03 nos anos não bissextos', () => {
    expect(ageOn('2008-02-29', new Date('2026-02-28T15:00:00Z'))).toBe(17);
    expect(ageOn('2008-02-29', new Date('2026-03-01T15:00:00Z'))).toBe(18);
  });
});
