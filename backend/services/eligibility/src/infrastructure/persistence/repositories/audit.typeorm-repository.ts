import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuditRepository } from '../../../application/ports/audit.repository';
import type { AccessAudit, NewAccessAudit } from '../../../domain/entities/access-audit';
import { AccessAuditMapper } from '../mappers/access-audit.mapper';
import { AccessAuditOrmEntity } from '../orm-entities/access-audit.orm-entity';

@Injectable()
export class AuditTypeOrmRepository implements AuditRepository {
  constructor(
    @InjectRepository(AccessAuditOrmEntity)
    private readonly repo: Repository<AccessAuditOrmEntity>,
  ) {}

  async create(draft: NewAccessAudit): Promise<AccessAudit> {
    const saved = await this.repo.save(this.repo.create(draft));
    return AccessAuditMapper.toDomain(saved);
  }

  async listByDonor(donorId: string, limit: number): Promise<AccessAudit[]> {
    const list = await this.repo.find({
      where: { donorId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return list.map(AccessAuditMapper.toDomain);
  }
}
