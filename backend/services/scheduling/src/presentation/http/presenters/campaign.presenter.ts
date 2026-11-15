import type { BloodType } from '@shared/domain/enums';
import type { CampaignType } from '../../../domain/enums';
import type { CampaignOutput } from '../../../application/dto';

/** Representação HTTP de uma campanha. */
export interface CampaignResponse {
  id: string;
  title: string;
  description: string;
  type: CampaignType;
  targetBloodType: BloodType | null;
  collectionUnitId: string | null;
  startDate: string;
  endDate: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toCampaignResponse(campaign: CampaignOutput): CampaignResponse {
  return {
    id: campaign.id,
    title: campaign.title,
    description: campaign.description,
    type: campaign.type,
    targetBloodType: campaign.targetBloodType,
    collectionUnitId: campaign.collectionUnitId,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    active: campaign.active,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
  };
}
