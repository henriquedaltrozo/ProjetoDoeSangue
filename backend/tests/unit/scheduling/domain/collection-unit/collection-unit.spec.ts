import { BusinessRuleError, InvalidValueError } from '@src/domain/errors';
import { CollectionUnit } from '@src/domain/collection-unit/collection-unit';

const NOW = new Date('2026-09-10T12:00:00.000Z');

const oneUnit = (active = true, simultaneousCapacity = 2) =>
  new CollectionUnit({
    id: 'u-1',
    name: 'Central',
    address: 'Rua A',
    neighborhood: 'Centro',
    city: 'Recife',
    uf: 'PE',
    phone: '8130000000',
    simultaneousCapacity,
    operatingHours: null,
    active,
    createdAt: NOW,
    updatedAt: NOW,
  });

const data = {
  name: 'Central',
  address: 'Rua A',
  neighborhood: 'Centro',
  city: 'Recife',
  uf: 'PE',
  phone: '8130000000',
  simultaneousCapacity: 3,
};

describe('CollectionUnit', () => {
  describe('new', () => {
    it('exige o bairro (sem espaços nas pontas)', () => {
      expect(() => CollectionUnit.draft({ ...data, neighborhood: '  ' })).toThrow(
        InvalidValueError,
      );
      expect(CollectionUnit.draft({ ...data, neighborhood: ' Boa Vista ' }).neighborhood).toBe(
        'Boa Vista',
      );
    });

    it('nasce ativa, com horário de funcionamento nulo se não informado', () => {
      expect(CollectionUnit.draft(data)).toEqual({
        ...data,
        operatingHours: null,
        active: true,
      });
    });

    it('guarda o horário de funcionamento informado', () => {
      const time = { sex: ['08:00-17:00'] };

      expect(CollectionUnit.draft({ ...data, operatingHours: time }).operatingHours).toBe(time);
    });

    it.each([
      ['dia desconhecido', { xyz: ['08:00-12:00'] }],
      ['faixa malformada', { seg: ['8h-12h'] }],
      ['início depois do fim', { seg: ['12:00-08:00'] }],
      ['faixas fora de uma lista', { seg: 8 as unknown as string[] }],
      ['faixa que não é texto', { seg: [800 as unknown as string] }],
    ])('rejeita horário de funcionamento com %s', (_d, operatingHours) => {
      expect(() => CollectionUnit.draft({ ...data, operatingHours })).toThrow(InvalidValueError);
    });
  });

  describe('ensureOpenAt', () => {
    // 2026-09-14 é uma segunda-feira; 11:00Z = 08:00 em Brasília.
    const unit = (operatingHours: Record<string, string[]> | null) =>
      new CollectionUnit({
        id: 'u',
        ...data,
        operatingHours,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    it('sem horário cadastrado, aceita qualquer horário', () => {
      expect(() => unit(null).ensureOpenAt(new Date('2026-09-14T06:00:00Z'))).not.toThrow();
    });

    it('aceita do início da faixa até antes do fim, no horário de Brasília', () => {
      const open = unit({ seg: ['08:00-12:00', '13:00-17:00'] });
      expect(() => open.ensureOpenAt(new Date('2026-09-14T11:00:00Z'))).not.toThrow();
      expect(() => open.ensureOpenAt(new Date('2026-09-14T16:30:00Z'))).not.toThrow();
      expect(() => open.ensureOpenAt(new Date('2026-09-14T15:30:00Z'))).toThrow(BusinessRuleError);
      expect(() => open.ensureOpenAt(new Date('2026-09-14T20:00:00Z'))).toThrow(BusinessRuleError);
    });

    it('recusa dia em que a unidade não atende (aceita "sáb" com acento)', () => {
      const open = unit({ sáb: ['08:00-12:00'] });
      expect(() => open.ensureOpenAt(new Date('2026-09-19T12:00:00Z'))).not.toThrow();
      expect(() => open.ensureOpenAt(new Date('2026-09-14T12:00:00Z'))).toThrow(BusinessRuleError);
    });

    it.each([0, -1, 1.5, Number.NaN])('rejeita capacidade %s', (capacity) => {
      expect(() => CollectionUnit.draft({ ...data, simultaneousCapacity: capacity })).toThrow(
        InvalidValueError,
      );
    });
  });

  it('desativar e reativar alternam o flag ativo', () => {
    const unit = oneUnit();

    unit.deactivate();
    expect(unit.active).toBe(false);
    unit.reactivate();
    expect(unit.active).toBe(true);
  });

  it('ensureActive só rejeita unidades inativas', () => {
    expect(() => oneUnit(true).ensureActive()).not.toThrow();
    expect(() => oneUnit(false).ensureActive()).toThrow(
      new BusinessRuleError('Unidade de coleta inativa.'),
    );
  });

  it('ensureAvailableSlot rejeita quando as ocupadas já atingiram a capacidade', () => {
    const unit = oneUnit(true, 2);

    expect(() => unit.ensureAvailableSlot(0)).not.toThrow();
    expect(() => unit.ensureAvailableSlot(1)).not.toThrow();
    expect(() => unit.ensureAvailableSlot(2)).toThrow(
      new BusinessRuleError('Não há vagas disponíveis neste horário.'),
    );
    expect(() => unit.ensureAvailableSlot(3)).toThrow(BusinessRuleError);
  });
});
