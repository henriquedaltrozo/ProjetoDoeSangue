import { PasswordResetToken } from '../../../domain/entities/password-reset-token';
import { PasswordResetTokenOrmEntity } from '../orm-entities/password-reset-token.orm-entity';

export const PasswordResetTokenMapper = {
  toDomain(orm: PasswordResetTokenOrmEntity): PasswordResetToken {
    return new PasswordResetToken({
      id: orm.id,
      userId: orm.userId,
      tokenHash: orm.tokenHash,
      expiresAt: orm.expiresAt,
      usedAt: orm.usedAt,
      createdAt: orm.createdAt,
    });
  },

  toOrm(token: PasswordResetToken): PasswordResetTokenOrmEntity {
    const orm = new PasswordResetTokenOrmEntity();
    orm.id = token.id;
    orm.userId = token.userId;
    orm.tokenHash = token.tokenHash;
    orm.expiresAt = token.expiresAt;
    orm.usedAt = token.usedAt;
    orm.createdAt = token.createdAt;
    return orm;
  },
};
