import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { CampaignRepository } from '../../../application/ports';
import { Campaign, NewCampaign } from '../../../domain/campaign';
import { CampaignMapper } from '../mappers/campaign.mapper';
import { CampaignOrmEntity } from '../orm-entities/campaign.orm-entity';

@Injectable()
export class CampaignTypeOrmRepository implements CampaignRepository {
  constructor(
    @InjectRepository(CampaignOrmEntity) private readonly repo: Repository<CampaignOrmEntity>,
  ) {}

  async create(draft: NewCampaign): Promise<Campaign> {
    const saved = await this.repo.save(CampaignMapper.newForOrm(draft));
    return CampaignMapper.toDomain(saved);
  }

  async save(campaign: Campaign): Promise<Campaign> {
    const saved = await this.repo.save(CampaignMapper.toOrm(campaign));
    return CampaignMapper.toDomain(saved);
  }

  async findById(id: string): Promise<Campaign | null> {
    const orm = await this.repo.findOne({ where: { id } });
    return orm ? CampaignMapper.toDomain(orm) : null;
  }

  async listActive(todayISO: string): Promise<Campaign[]> {
    const list = await this.repo.find({
      where: { active: true, endDate: MoreThanOrEqual(todayISO) },
      order: { startDate: 'DESC' },
    });
    return list.map(CampaignMapper.toDomain);
  }
}
