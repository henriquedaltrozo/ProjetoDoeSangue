import { UnfitnessCategory } from '../enums';
import { addDays } from '../services/dates';
import {
  BusinessRuleError,
  InvalidValueError,
  UnfitnessAlreadyEndedError,
} from '../errors/domain.errors';

export interface TemporaryUnfitnessProps {
  id: string;
  donorId: string;
  reason: string;
  category: UnfitnessCategory;
  startDate: string;
  expectedEndDate: string | null;
  actualEndDate: string | null;
  registeredBy: string | null;
  createdAt: Date;
}

export type NewTemporaryUnfitness = Omit<TemporaryUnfitnessProps, 'id' | 'createdAt'>;

export interface NewUnfitnessData {
  donorId: string;
  reason: string;
  category: UnfitnessCategory;
  startDate: string;
  expectedEndDate?: string;
  registeredBy?: string;
}

/**
 * Período de inaptidão temporária (tatuagem, gravidez, viagem a área de malária, etc.). "Está
 * inapto agora" é calculado a partir das datas, não um flag persistido.
 */
export class TemporaryUnfitness {
  readonly id: string;
  readonly donorId: string;
  readonly reason: string;
  readonly category: UnfitnessCategory;
  readonly startDate: string;
  readonly expectedEndDate: string | null;
  readonly actualEndDate: string | null;
  readonly registeredBy: string | null;
  readonly createdAt: Date;

  constructor(props: TemporaryUnfitnessProps) {
    this.id = props.id;
    this.donorId = props.donorId;
    this.reason = props.reason;
    this.category = props.category;
    this.startDate = props.startDate;
    this.expectedEndDate = props.expectedEndDate;
    this.actualEndDate = props.actualEndDate;
    this.registeredBy = props.registeredBy;
    this.createdAt = props.createdAt;
  }

  static draft(data: NewUnfitnessData): NewTemporaryUnfitness {
    if (data.expectedEndDate && data.expectedEndDate < data.startDate) {
      throw new InvalidValueError('A data prevista de fim não pode ser anterior ao início.');
    }
    return {
      donorId: data.donorId,
      reason: data.reason,
      category: data.category,
      startDate: data.startDate,
      expectedEndDate: data.expectedEndDate ?? null,
      actualEndDate: null,
      registeredBy: data.registeredBy ?? null,
    };
  }

  /**
   * Em vigor em `todayISO`: já começou e ainda não terminou. Encerrada antecipadamente, vale até a
   * véspera do encerramento (no dia do encerramento o doador já está liberado); senão, até o fim
   * previsto (inclusive), ou sem fim se não houver previsão. Espelha o filtro SQL do repositório.
   */
  isActiveAt(todayISO: string): boolean {
    if (this.startDate > todayISO) {
      return false;
    }
    const end = this.lastDay();
    return end === null || todayISO <= end;
  }

  /**
   * Último dia (inclusive) de inaptidão: a véspera do encerramento antecipado, se houve, senão o fim
   * previsto; null se em aberto.
   */
  lastDay(): string | null {
    return this.actualEndDate ? addDays(this.actualEndDate, -1) : this.expectedEndDate;
  }

  /**
   * Das inaptidões em vigor, a que mais restringe: uma em aberto (sem fim), senão a que termina por
   * último. É ela que decide a próxima data em que o doador volta a poder doar.
   */
  static mostRestrictive(list: TemporaryUnfitness[]): TemporaryUnfitness | null {
    return list.reduce<TemporaryUnfitness | null>((chosen, current) => {
      if (!chosen) return current;
      const chosenEnd = chosen.lastDay();
      const currentEnd = current.lastDay();
      if (chosenEnd === null) return chosen;
      if (currentEnd === null) return current;
      return currentEnd > chosenEnd ? current : chosen;
    }, null);
  }

  /**
   * Encerra antecipadamente um período ainda em vigor. `actualEndDate` é o dia a partir do qual o
   * doador está liberado (encerrar hoje libera hoje mesmo). Fica entre o início do período e hoje:
   * não pode estender a inaptidão nem encerrar um período que já terminou.
   */
  end(actualEndDate: string, todayISO: string): void {
    if (this.actualEndDate) {
      throw new UnfitnessAlreadyEndedError();
    }
    if (this.expectedEndDate && this.expectedEndDate < todayISO) {
      throw new BusinessRuleError('Este período de inaptidão já terminou na data prevista.');
    }
    if (actualEndDate < this.startDate) {
      throw new InvalidValueError('O encerramento não pode ser anterior ao início do período.');
    }
    if (actualEndDate > todayISO) {
      throw new InvalidValueError('O encerramento antecipado não pode ser numa data futura.');
    }
    Object.assign(this, { actualEndDate });
  }

  /** [LGPD] Substitui o motivo (texto livre, possivelmente identificante) na anonimização. */
  redactReason(replacement: string): void {
    Object.assign(this, { reason: replacement });
  }
}
