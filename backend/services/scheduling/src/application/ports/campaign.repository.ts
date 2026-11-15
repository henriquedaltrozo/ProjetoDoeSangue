import { Campaign, NewCampaign } from '../../domain/campaign';

export const CAMPAIGN_REPOSITORY = Symbol('CAMPAIGN_REPOSITORY');

export interface CampaignRepository {
  create(draft: NewCampaign): Promise<Campaign>;
  save(campaign: Campaign): Promise<Campaign>;
  findById(id: string): Promise<Campaign | null>;
  /** Ativas e ainda não encerradas (endDate >= hoje), mais recentes (startDate) primeiro. */
  listActive(todayISO: string): Promise<Campaign[]>;
}
