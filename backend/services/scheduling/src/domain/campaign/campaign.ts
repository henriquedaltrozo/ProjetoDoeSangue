import { BloodType } from '@shared/domain/enums';
import { toBusinessDate } from '@shared/domain/time';
import { CampaignType } from '../enums';
import { BusinessRuleError, InvalidValueError } from '../errors';

export interface CampaignProps {
  id: string;
  title: string;
  description: string;
  type: CampaignType;
  targetBloodType: BloodType | null;
  collectionUnitId: string | null;
  /** Data (AAAA-MM-DD). */
  startDate: string;
  /** Data (AAAA-MM-DD). */
  endDate: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Campaign ainda não persistida (o id e os carimbos de data nascem na persistência). */
export interface NewCampaign {
  title: string;
  description: string;
  type: CampaignType;
  targetBloodType: BloodType | null;
  collectionUnitId: string | null;
  startDate: string;
  endDate: string;
  active: boolean;
}

export interface NewCampaignData {
  title: string;
  description: string;
  type: CampaignType;
  targetBloodType?: BloodType | null;
  collectionUnitId?: string | null;
  startDate: string;
  endDate: string;
}

export class Campaign implements CampaignProps {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly type: CampaignType;
  readonly targetBloodType: BloodType | null;
  readonly collectionUnitId: string | null;
  readonly startDate: string;
  readonly endDate: string;
  readonly active: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: CampaignProps) {
    Object.assign(this, props);
  }

  /**
   * Cria uma campanha nova, sempre ativa. O período precisa terminar no início ou depois dele. O tipo
   * sanguíneo é opcional nos dois tipos de campanha: sem ele, a campanha vale para todos os tipos.
   */
  static draft(data: NewCampaignData): NewCampaign {
    if (data.endDate < data.startDate) {
      throw new InvalidValueError('A data de fim da campanha não pode ser anterior ao início.');
    }
    return {
      title: data.title,
      description: data.description,
      type: data.type,
      targetBloodType: data.targetBloodType ?? null,
      collectionUnitId: data.collectionUnitId ?? null,
      startDate: data.startDate,
      endDate: data.endDate,
      active: true,
    };
  }

  deactivate(): void {
    this.mutate({ active: false });
  }

  /** Só campanhas ativas aceitam novos agendamentos. */
  ensureActive(): void {
    if (!this.active) {
      throw new BusinessRuleError('Campanha inativa.');
    }
  }

  /**
   * Um agendamento vinculado à campanha precisa cair no período dela (dia de Brasília) e, se a
   * campanha é de uma unidade, ser nessa unidade.
   */
  ensureAcceptsAppointment(collectionUnitId: string, dateTime: Date): void {
    this.ensureActive();
    const day = toBusinessDate(dateTime);
    if (day < this.startDate || day > this.endDate) {
      throw new BusinessRuleError('O horário escolhido está fora do período da campanha.');
    }
    if (this.collectionUnitId && this.collectionUnitId !== collectionUnitId) {
      throw new BusinessRuleError('Esta campanha é de outra unidade de coleta.');
    }
  }

  /** O período da campanha já acabou no dia `todayISO` (AAAA-MM-DD). */
  hasEnded(todayISO: string): boolean {
    return this.endDate < todayISO;
  }

  /** Campanhas urgentes disparam aviso aos doadores compatíveis (do tipo sanguíneo, se houver). */
  requiresDonorNotification(): boolean {
    return this.type === CampaignType.URGENT;
  }

  /** Único ponto de alteração de estado: só os métodos de domínio mudam a entidade. */
  private mutate(changes: Partial<CampaignProps>): void {
    Object.assign(this, changes);
  }
}
