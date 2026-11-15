import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  SuppressedRecipient,
  SuppressionList,
} from '../../../application/ports/suppression-list.port';
import { SuppressedRecipientOrmEntity } from '../orm-entities/suppressed-recipient.orm-entity';

const normalize = (email: string) => email.trim().toLowerCase();

@Injectable()
export class SuppressionListTypeOrmRepository implements SuppressionList {
  constructor(
    @InjectRepository(SuppressedRecipientOrmEntity)
    private readonly repo: Repository<SuppressedRecipientOrmEntity>,
  ) {}

  async reasonFor(email: string): Promise<string | null> {
    const row = await this.repo.findOne({ where: { email: normalize(email) } });
    return row?.reason ?? null;
  }

  async add(email: string, reason: string): Promise<void> {
    await this.repo.upsert({ email: normalize(email), reason }, ['email']);
  }

  async remove(email: string): Promise<boolean> {
    return ((await this.repo.delete({ email: normalize(email) })).affected ?? 0) > 0;
  }

  async list(limit: number): Promise<SuppressedRecipient[]> {
    const rows = await this.repo.find({ order: { createdAt: 'DESC' }, take: limit });
    return rows.map((r) => ({ email: r.email, reason: r.reason, createdAt: r.createdAt }));
  }
}
