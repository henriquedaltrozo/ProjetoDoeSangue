import { type CampaignOutput, toCampaignOutput } from '../../dto';
import { CAMPAIGN_REPOSITORY, CampaignRepository } from '../../ports';
import { loadCampaignOrFail } from '../shared/load-or-fail';

export class FindCampaignUseCase {
  static readonly inject = [CAMPAIGN_REPOSITORY] as const;

  constructor(private readonly campaigns: CampaignRepository) {}

  async execute(id: string): Promise<CampaignOutput> {
    const campaign = await loadCampaignOrFail(this.campaigns, id);
    return toCampaignOutput(campaign);
  }
}
