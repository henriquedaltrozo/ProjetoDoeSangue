import { addDays, addMonths, calculateAge, toDateISO } from '@src/domain/services/dates';

describe('dates', () => {
  it('toDateISO devolve AAAA-MM-DD em UTC', () => {
    expect(toDateISO(new Date('2026-10-02T23:59:59.000Z'))).toBe('2026-10-02');
  });

  it('addDays atravessa fim de mês e de ano', () => {
    expect(addDays('2026-12-20', 56)).toBe('2027-02-14');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('calculateAge só conta o aniversário depois que ele ocorre', () => {
    const reference = new Date(2026, 9, 2, 12);
    expect(calculateAge('2000-09-15', reference)).toBe(26);
    expect(calculateAge('2000-10-20', reference)).toBe(25);
    expect(calculateAge('2000-12-01', reference)).toBe(25);
  });

  it('addMonths soma meses de calendário e ajusta o dia ao fim de meses mais curtos', () => {
    expect(addMonths('2026-08-02', 2)).toBe('2026-10-02');
    expect(addMonths('2026-12-31', 2)).toBe('2027-02-28');
    expect(addMonths('2027-12-31', 2)).toBe('2028-02-29');
    expect(addMonths('2026-11-30', 3)).toBe('2027-02-28');
    expect(addMonths('2025-10-02', 12)).toBe('2026-10-02');
    expect(addMonths('2026-03-15', -12)).toBe('2025-03-15');
  });
});
