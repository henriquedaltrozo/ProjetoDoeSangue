import { type CampaignOutput, toCampaignOutput } from '../../dto';
import { CAMPAIGN_REPOSITORY, CampaignRepository } from '../../ports';
import { loadCampaignOrFail } from '../shared/load-or-fail';

/** [admin] Desativa uma campanha. */
export class DeactivateCampaignUseCase {
  static readonly inject = [CAMPAIGN_REPOSITORY] as const;

  constructor(private readonly campaigns: CampaignRepository) {}

  async execute(id: string): Promise<CampaignOutput> {
    const campaign = await loadCampaignOrFail(this.campaigns, id);
    campaign.deactivate();
    return toCampaignOutput(await this.campaigns.save(campaign));
  }
}
