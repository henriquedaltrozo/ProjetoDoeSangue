import { sumDuration } from '@src/domain/services/duration';

describe('sumDuration', () => {
  const base = new Date('2026-01-01T00:00:00.000Z');

  it.each([
    ['30s', 30_000],
    ['15m', 15 * 60_000],
    ['1h', 3_600_000],
    ['7d', 7 * 86_400_000],
    [' 2 h ', 2 * 3_600_000],
  ])('interpreta o sufixo de %s', (duration, expectedMs) => {
    expect(sumDuration(base, duration).getTime()).toBe(base.getTime() + expectedMs);
  });

  it('sem sufixo, interpreta como segundos', () => {
    expect(sumDuration(base, '90').getTime()).toBe(base.getTime() + 90_000);
  });

  it('valor vazio não altera a data', () => {
    expect(sumDuration(base, '').getTime()).toBe(base.getTime());
  });

  it.each(['1w', '7 dias', '-5'])('recusa formato inválido (%s)', (duration) => {
    expect(() => sumDuration(base, duration)).toThrow(/Duração inválida/);
  });
});
