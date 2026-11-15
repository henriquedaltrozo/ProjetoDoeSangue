import { birthdayAt, calculateAge } from '@src/domain/services/dates';

describe('birthdayAt', () => {
  it('soma os anos mantendo dia e mês', () => {
    expect(birthdayAt('2010-10-29', 16)).toBe('2026-10-29');
  });

  it('29/02 vira 01/03 em ano não bissexto, coerente com calculateAge', () => {
    const birthday = birthdayAt('2008-02-29', 18);
    expect(birthday).toBe('2026-03-01');
    expect(calculateAge('2008-02-29', new Date(`${birthday}T15:00:00Z`))).toBe(18);
    expect(calculateAge('2008-02-29', new Date('2026-02-28T15:00:00Z'))).toBe(17);
  });

  it('29/02 continua 29/02 em ano bissexto', () => {
    expect(birthdayAt('2008-02-29', 16)).toBe('2024-02-29');
  });
});
