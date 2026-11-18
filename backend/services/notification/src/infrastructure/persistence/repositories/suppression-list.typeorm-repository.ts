import { emailIndex } from '@shared/infrastructure/persistence';
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
    const row = await this.repo.findOne({ where: { emailIndex: emailIndex(email) } });
    return row?.reason ?? null;
  }

  async add(email: string, reason: string): Promise<void> {
    await this.repo.upsert({ emailIndex: emailIndex(email), email: normalize(email), reason }, [
      'emailIndex',
    ]);
  }

  async remove(email: string): Promise<boolean> {
    return ((await this.repo.delete({ emailIndex: emailIndex(email) })).affected ?? 0) > 0;
  }

  async list(limit: number): Promise<SuppressedRecipient[]> {
    const rows = await this.repo.find({ order: { createdAt: 'DESC' }, take: limit });
    return rows.map((r) => ({ email: r.email, reason: r.reason, createdAt: r.createdAt }));
  }
}
