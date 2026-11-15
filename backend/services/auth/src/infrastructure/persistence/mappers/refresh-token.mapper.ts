import { RefreshToken } from '../../../domain/entities/refresh-token';
import { RefreshTokenOrmEntity } from '../orm-entities/refresh-token.orm-entity';

export const RefreshTokenMapper = {
  toDomain(orm: RefreshTokenOrmEntity): RefreshToken {
    return new RefreshToken({
      id: orm.id,
      userId: orm.userId,
      tokenHash: orm.tokenHash,
      expiresAt: orm.expiresAt,
      revokedAt: orm.revokedAt,
      createdAt: orm.createdAt,
    });
  },

  toOrm(token: RefreshToken): RefreshTokenOrmEntity {
    const orm = new RefreshTokenOrmEntity();
    orm.id = token.id;
    orm.userId = token.userId;
    orm.tokenHash = token.tokenHash;
    orm.expiresAt = token.expiresAt;
    orm.revokedAt = token.revokedAt;
    orm.createdAt = token.createdAt;
    return orm;
  },
};
