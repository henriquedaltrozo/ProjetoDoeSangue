import { Campaign, NewCampaign } from '../../../domain/campaign';
import { CampaignOrmEntity } from '../orm-entities/campaign.orm-entity';

export const CampaignMapper = {
  toDomain(orm: CampaignOrmEntity): Campaign {
    return new Campaign({
      id: orm.id,
      title: orm.title,
      description: orm.description,
      type: orm.type,
      targetBloodType: orm.targetBloodType,
      collectionUnitId: orm.collectionUnitId,
      startDate: orm.startDate,
      endDate: orm.endDate,
      active: orm.active,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  },

  toOrm(campaign: Campaign): CampaignOrmEntity {
    return Object.assign(new CampaignOrmEntity(), {
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
    });
  },

  newForOrm(draft: NewCampaign): CampaignOrmEntity {
    return Object.assign(new CampaignOrmEntity(), draft);
  },
};
