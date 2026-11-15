import { PasswordResetTokenOrmEntity } from '@src/infrastructure/persistence/orm-entities/password-reset-token.orm-entity';
import { RefreshTokenOrmEntity } from '@src/infrastructure/persistence/orm-entities/refresh-token.orm-entity';
import { UserOrmEntity } from '@src/infrastructure/persistence/orm-entities/user.orm-entity';
import { PasswordResetTokenMapper } from '@src/infrastructure/persistence/mappers/password-reset-token.mapper';
import { RefreshTokenMapper } from '@src/infrastructure/persistence/mappers/refresh-token.mapper';
import { UserMapper } from '@src/infrastructure/persistence/mappers/user.mapper';

const now = new Date('2026-10-02T12:00:00Z');

describe('mappers do auth', () => {
  it('User: ida e volta, com loginFailures nulo virando 0', () => {
    const orm = Object.assign(new UserOrmEntity(), {
      id: 'u1',
      email: 'a@x.com',
      passwordHash: 'h',
      role: 'DONOR',
      name: 'Ana',
      donorId: 'd1',
      active: true,
      loginFailures: undefined,
      blockedUntil: null,
      lastLoginAt: null,
      createdAt: now,
    });
    const user = UserMapper.toDomain(orm);
    expect(user.loginFailures).toBe(0);
    expect(UserMapper.toOrm(user)).toMatchObject({
      id: 'u1',
      email: 'a@x.com',
      donorId: 'd1',
      loginFailures: 0,
    });
  });

  it('RefreshToken: preserva revokedAt', () => {
    const orm = Object.assign(new RefreshTokenOrmEntity(), {
      id: 'r1',
      userId: 'u1',
      tokenHash: 'h',
      expiresAt: now,
      revokedAt: now,
      createdAt: now,
    });
    const token = RefreshTokenMapper.toDomain(orm);
    expect(RefreshTokenMapper.toOrm(token)).toMatchObject({ id: 'r1', revokedAt: now });
  });

  it('PasswordResetToken: preserva usedAt', () => {
    const orm = Object.assign(new PasswordResetTokenOrmEntity(), {
      id: 'p1',
      userId: 'u1',
      tokenHash: 'h',
      expiresAt: now,
      usedAt: null,
      createdAt: now,
    });
    const token = PasswordResetTokenMapper.toDomain(orm);
    expect(PasswordResetTokenMapper.toOrm(token)).toMatchObject({ id: 'p1', usedAt: null });
  });
});
