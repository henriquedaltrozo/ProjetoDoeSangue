import { toBusinessWeekdayTime } from '@shared/domain/time';
import { BusinessRuleError, InvalidValueError } from '../errors';

/** Por dia da semana (dom, seg, ter, qua, qui, sex, sab), faixas "HH:MM-HH:MM". */
export type OperatingHours = Record<string, string[]>;

/** Chaves aceitas em OperatingHours, na ordem de Date#getDay (0 = domingo). */
export const WEEKDAY_KEYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

const RANGE = /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/;

function normalizeWeekday(key: string): string {
  return key
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .slice(0, 3);
}

/** Valida o formato: dia da semana conhecido e faixas "HH:MM-HH:MM" com início antes do fim. */
function validateOperatingHours(hours: OperatingHours): void {
  for (const [day, ranges] of Object.entries(hours)) {
    if (!WEEKDAY_KEYS.includes(normalizeWeekday(day))) {
      throw new InvalidValueError(
        `Dia da semana inválido no horário de funcionamento: "${day}" (use dom, seg, ter, qua, qui, sex, sab).`,
      );
    }
    if (!Array.isArray(ranges)) {
      throw new InvalidValueError(
        `Horário de funcionamento inválido para "${day}": informe uma lista de faixas HH:MM-HH:MM.`,
      );
    }
    for (const range of ranges) {
      if (typeof range !== 'string' || !RANGE.test(range) || range.slice(0, 5) >= range.slice(6)) {
        throw new InvalidValueError(
          `Faixa inválida no horário de funcionamento: "${range}" (use HH:MM-HH:MM).`,
        );
      }
    }
  }
}

export interface CollectionUnitProps {
  id: string;
  name: string;
  address: string;
  /** Bairro. Null nas unidades cadastradas antes do campo existir. */
  neighborhood: string | null;
  city: string;
  uf: string;
  phone: string;
  simultaneousCapacity: number;
  /** Estrutura por dia da semana, ex: {"seg": ["08:00-17:00"]}. Informativo por enquanto. */
  operatingHours: OperatingHours | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Unidade ainda não persistida (o id e os carimbos de data nascem na persistência). */
export interface NewCollectionUnit {
  name: string;
  address: string;
  neighborhood: string;
  city: string;
  uf: string;
  phone: string;
  simultaneousCapacity: number;
  operatingHours: OperatingHours | null;
  active: boolean;
}

export interface NewCollectionUnitData {
  name: string;
  address: string;
  neighborhood: string;
  city: string;
  uf: string;
  phone: string;
  simultaneousCapacity: number;
  operatingHours?: OperatingHours | null;
}

export class CollectionUnit implements CollectionUnitProps {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly neighborhood: string | null;
  readonly city: string;
  readonly uf: string;
  readonly phone: string;
  readonly simultaneousCapacity: number;
  readonly operatingHours: OperatingHours | null;
  readonly active: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: CollectionUnitProps) {
    Object.assign(this, props);
  }

  /** Cadastra uma unidade nova, sempre ativa. */
  static draft(data: NewCollectionUnitData): NewCollectionUnit {
    if (!Number.isInteger(data.simultaneousCapacity) || data.simultaneousCapacity < 1) {
      throw new InvalidValueError('simultaneousCapacity deve ser um inteiro maior ou igual a 1.');
    }
    if (data.operatingHours) {
      validateOperatingHours(data.operatingHours);
    }
    const neighborhood = data.neighborhood?.trim() ?? '';
    if (neighborhood.length < 2) {
      throw new InvalidValueError('Informe o bairro da unidade.');
    }
    return {
      name: data.name,
      address: data.address,
      neighborhood,
      city: data.city,
      uf: data.uf,
      phone: data.phone,
      simultaneousCapacity: data.simultaneousCapacity,
      operatingHours: data.operatingHours ?? null,
      active: true,
    };
  }

  deactivate(): void {
    this.mutate({ active: false });
  }

  reactivate(): void {
    this.mutate({ active: true });
  }

  /** Só unidades ativas aceitam novos agendamentos. */
  ensureActive(): void {
    if (!this.active) {
      throw new BusinessRuleError('Unidade de coleta inativa.');
    }
  }

  /**
   * O horário cai dentro do funcionamento da unidade (a faixa inclui o início e exclui o fim). Sem
   * horário de funcionamento cadastrado, qualquer horário da grade é aceito.
   */
  ensureOpenAt(dateTime: Date): void {
    if (!this.operatingHours || Object.keys(this.operatingHours).length === 0) return;
    const { weekday, time } = toBusinessWeekdayTime(dateTime);
    const ranges = Object.entries(this.operatingHours)
      .filter(([day]) => normalizeWeekday(day) === WEEKDAY_KEYS[weekday])
      .flatMap(([, list]) => list);
    if (!ranges.some((range) => range.slice(0, 5) <= time && time < range.slice(6))) {
      throw new BusinessRuleError('A unidade não atende neste dia e horário.');
    }
  }

  /** Garante que ainda há vaga num horário que já tem `occupied` vagas tomadas. */
  ensureAvailableSlot(occupied: number): void {
    if (occupied >= this.simultaneousCapacity) {
      throw new BusinessRuleError('Não há vagas disponíveis neste horário.');
    }
  }

  /** Único ponto de alteração de estado: só os métodos de domínio mudam a entidade. */
  private mutate(changes: Partial<CollectionUnitProps>): void {
    Object.assign(this, changes);
  }
}
