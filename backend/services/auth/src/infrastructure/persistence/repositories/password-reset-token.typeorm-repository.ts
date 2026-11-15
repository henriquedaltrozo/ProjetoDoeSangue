import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { PasswordResetTokenRepository } from '../../../application/ports/password-reset-token.repository';
import { PasswordResetToken } from '../../../domain/entities/password-reset-token';
import { PasswordResetTokenMapper } from '../mappers/password-reset-token.mapper';
import { PasswordResetTokenOrmEntity } from '../orm-entities/password-reset-token.orm-entity';

@Injectable()
export class PasswordResetTokenTypeOrmRepository implements PasswordResetTokenRepository {
  constructor(
    @InjectRepository(PasswordResetTokenOrmEntity)
    private readonly repo: Repository<PasswordResetTokenOrmEntity>,
  ) {}

  async findByHash(tokenHash: string): Promise<PasswordResetToken | null> {
    const orm = await this.repo.findOne({ where: { tokenHash } });
    return orm ? PasswordResetTokenMapper.toDomain(orm) : null;
  }

  async save(token: PasswordResetToken): Promise<void> {
    await this.repo.save(PasswordResetTokenMapper.toOrm(token));
  }

  async consumeIfUnused(tokenId: string, when: Date): Promise<boolean> {
    const result = await this.repo.update({ id: tokenId, usedAt: IsNull() }, { usedAt: when });
    return result.affected === 1;
  }

  async invalidateUserPending(userId: string, when: Date): Promise<void> {
    await this.repo.update({ userId, usedAt: IsNull() }, { usedAt: when });
  }

  async purgeExpired(before: Date): Promise<number> {
    return (await this.repo.delete({ expiresAt: LessThan(before) })).affected ?? 0;
  }
}
