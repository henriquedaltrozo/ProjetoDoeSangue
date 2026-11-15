import { toBusinessDate } from '@shared/domain/time';
import { type CampaignOutput, toCampaignOutput } from '../../dto';
import { CAMPAIGN_REPOSITORY, CampaignRepository, CLOCK, Clock } from '../../ports';

/** Campanhas ativas e ainda não encerradas (usado na home do portal do doador). */
export class ListActiveCampaignsUseCase {
  static readonly inject = [CAMPAIGN_REPOSITORY, CLOCK] as const;

  constructor(
    private readonly campaigns: CampaignRepository,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<CampaignOutput[]> {
    const today = toBusinessDate(this.clock.now());
    return (await this.campaigns.listActive(today)).map(toCampaignOutput);
  }
}
