import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { RefreshTokenRepository } from '../../../application/ports/refresh-token.repository';
import { RefreshToken } from '../../../domain/entities/refresh-token';
import { RefreshTokenMapper } from '../mappers/refresh-token.mapper';
import { RefreshTokenOrmEntity } from '../orm-entities/refresh-token.orm-entity';

@Injectable()
export class RefreshTokenTypeOrmRepository implements RefreshTokenRepository {
  constructor(
    @InjectRepository(RefreshTokenOrmEntity)
    private readonly repo: Repository<RefreshTokenOrmEntity>,
  ) {}

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    const orm = await this.repo.findOne({ where: { tokenHash } });
    return orm ? RefreshTokenMapper.toDomain(orm) : null;
  }

  async save(token: RefreshToken): Promise<void> {
    await this.repo.save(RefreshTokenMapper.toOrm(token));
  }

  async revokeIfActive(tokenId: string, when: Date): Promise<boolean> {
    const result = await this.repo.update(
      { id: tokenId, revokedAt: IsNull() },
      { revokedAt: when },
    );
    return result.affected === 1;
  }

  async revokeByHash(userId: string, tokenHash: string, when: Date): Promise<void> {
    await this.repo.update({ userId, tokenHash }, { revokedAt: when });
  }

  async deleteUserTokens(userId: string): Promise<void> {
    await this.repo.delete({ userId });
  }

  async purgeExpired(before: Date): Promise<number> {
    return (await this.repo.delete({ expiresAt: LessThan(before) })).affected ?? 0;
  }
}
