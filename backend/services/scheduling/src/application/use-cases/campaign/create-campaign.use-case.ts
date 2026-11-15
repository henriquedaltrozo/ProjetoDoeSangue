import { type CampaignOutput, toCampaignOutput } from '../../dto';
import { BloodType } from '@shared/domain/enums';
import { Campaign } from '../../../domain/campaign';
import { CampaignType } from '../../../domain/enums';
import { OutboxEvent } from '../../../domain/outbox';
import { toBusinessDate } from '@shared/domain/time';
import { InvalidValueError } from '../../../domain/errors';
import {
  CLOCK,
  Clock,
  COLLECTION_UNIT_REPOSITORY,
  CollectionUnitRepository,
  UNIT_OF_WORK,
  UnitOfWork,
} from '../../ports';
import { loadCollectionUnitOrFail } from '../shared/load-or-fail';

export interface CreateCampaignCommand {
  title: string;
  description: string;
  type: CampaignType;
  targetBloodType?: BloodType;
  collectionUnitId?: string;
  startDate: string;
  endDate: string;
}

/**
 * [admin] Cria uma campanha. Campanhas URGENT precisam avisar os doadores
 * aptos: a campanha e o evento do outbox que pede esse aviso são gravados na mesma transação, e o
 * despachante do outbox faz o aviso depois (com novas tentativas se o eligibility ou a fila falharem).
 * Assim o aviso não se perde se o serviço cair logo depois de criar a campanha.
 */
export class CreateCampaignUseCase {
  static readonly inject = [UNIT_OF_WORK, COLLECTION_UNIT_REPOSITORY, CLOCK] as const;

  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly units: CollectionUnitRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: CreateCampaignCommand): Promise<CampaignOutput> {
    const draft = Campaign.draft(command);
    // Uma campanha que já terminou não apareceria para ninguém (e uma urgente avisaria à toa).
    if (draft.endDate < toBusinessDate(this.clock.now())) {
      throw new InvalidValueError('A data de fim da campanha não pode estar no passado.');
    }
    // Unidade inexistente viraria erro de chave estrangeira (500); aqui vira 404.
    if (draft.collectionUnitId) {
      await loadCollectionUnitOrFail(this.units, draft.collectionUnitId);
    }
    const campaign = await this.unitOfWork.run(async (tx) => {
      const created = await tx.campaigns.create(draft);
      if (created.requiresDonorNotification()) {
        await tx.outbox.create(OutboxEvent.urgentCampaignCreated(created.id));
      }
      return created;
    });
    return toCampaignOutput(campaign);
  }
}
