import { createTestUnfitness, dateWithOffset } from '@test/support/fixtures.fake';
import { TemporaryUnfitness } from '@src/domain/entities/temporary-unfitness';
import {
  BusinessRuleError,
  InvalidValueError,
  UnfitnessAlreadyEndedError,
} from '@src/domain/errors/domain.errors';
import { UnfitnessCategory } from '@src/domain/enums';

describe('TemporaryUnfitness', () => {
  const today = dateWithOffset(0);

  it('só está ativa depois de começar', () => {
    expect(createTestUnfitness({ startDate: dateWithOffset(1) }).isActiveAt(today)).toBe(false);
    expect(createTestUnfitness({ startDate: today }).isActiveAt(today)).toBe(true);
  });

  it('sem nenhuma data de fim permanece ativa', () => {
    expect(createTestUnfitness().isActiveAt(today)).toBe(true);
  });

  it('vale até o fim previsto (inclusive) e expira depois', () => {
    expect(createTestUnfitness({ expectedEndDate: today }).isActiveAt(today)).toBe(true);
    expect(createTestUnfitness({ expectedEndDate: dateWithOffset(-1) }).isActiveAt(today)).toBe(
      false,
    );
  });

  it('o fim real prevalece sobre o previsto', () => {
    const unfitness = createTestUnfitness({
      expectedEndDate: dateWithOffset(30),
      actualEndDate: dateWithOffset(-1),
    });
    expect(unfitness.isActiveAt(today)).toBe(false);
  });

  it('recusa fim previsto anterior ao início', () => {
    expect(() =>
      TemporaryUnfitness.draft({
        donorId: 'd',
        reason: 'tatuagem',
        category: UnfitnessCategory.OTHER,
        startDate: '2026-10-10',
        expectedEndDate: '2026-10-09',
      }),
    ).toThrow(InvalidValueError);
  });

  it('encerrada num dia, vale até a véspera: o doador já está liberado no dia do encerramento', () => {
    const unfitness = createTestUnfitness({
      startDate: dateWithOffset(-5),
      expectedEndDate: dateWithOffset(30),
      actualEndDate: today,
    });
    expect(unfitness.isActiveAt(dateWithOffset(-1))).toBe(true);
    expect(unfitness.isActiveAt(today)).toBe(false);
    expect(unfitness.lastDay()).toBe(dateWithOffset(-1));
  });

  describe('encerramento antecipado', () => {
    it('grava o fim real e não pode ser repetido', () => {
      const unfitness = createTestUnfitness();
      unfitness.end(today, today);
      expect(unfitness.actualEndDate).toBe(today);
      expect(() => unfitness.end(today, today)).toThrow(UnfitnessAlreadyEndedError);
    });

    it('não aceita data futura (não estende a inaptidão)', () => {
      const unfitness = createTestUnfitness({ expectedEndDate: dateWithOffset(30) });
      expect(() => unfitness.end(dateWithOffset(1), today)).toThrow(InvalidValueError);
    });

    it('não aceita data anterior ao início', () => {
      const unfitness = createTestUnfitness({ startDate: dateWithOffset(-5) });
      expect(() => unfitness.end(dateWithOffset(-6), today)).toThrow(InvalidValueError);
    });

    it('não encerra um período que já terminou na data prevista', () => {
      const unfitness = createTestUnfitness({
        startDate: dateWithOffset(-10),
        expectedEndDate: dateWithOffset(-1),
      });
      expect(() => unfitness.end(dateWithOffset(-2), today)).toThrow(BusinessRuleError);
    });
  });

  it('das inaptidões em vigor, escolhe a em aberto ou a que termina por último', () => {
    const short = createTestUnfitness({ id: 'short', expectedEndDate: dateWithOffset(5) });
    const long = createTestUnfitness({ id: 'long', expectedEndDate: dateWithOffset(20) });
    const open = createTestUnfitness({ id: 'open' });
    expect(TemporaryUnfitness.mostRestrictive([short, long])?.id).toBe('long');
    expect(TemporaryUnfitness.mostRestrictive([long, open, short])?.id).toBe('open');
    expect(TemporaryUnfitness.mostRestrictive([])).toBeNull();
  });
});
