import { emailIndex } from '@shared/infrastructure/persistence';
import { User } from '../../../domain/entities/user';
import { UserOrmEntity } from '../orm-entities/user.orm-entity';

export const UserMapper = {
  toDomain(orm: UserOrmEntity): User {
    return new User({
      id: orm.id,
      email: orm.email,
      passwordHash: orm.passwordHash,
      role: orm.role,
      name: orm.name,
      donorId: orm.donorId,
      active: orm.active,
      loginFailures: orm.loginFailures ?? 0,
      blockedUntil: orm.blockedUntil,
      lastLoginAt: orm.lastLoginAt,
      createdAt: orm.createdAt,
      emailVerifiedAt: orm.emailVerifiedAt ?? null,
      pendingEmail: orm.pendingEmail ?? null,
    });
  },

  toOrm(user: User): UserOrmEntity {
    const orm = new UserOrmEntity();
    orm.id = user.id;
    orm.email = user.email;
    orm.emailIndex = emailIndex(user.email);
    orm.passwordHash = user.passwordHash;
    orm.role = user.role;
    orm.name = user.name;
    orm.donorId = user.donorId;
    orm.active = user.active;
    orm.loginFailures = user.loginFailures;
    orm.blockedUntil = user.blockedUntil;
    orm.lastLoginAt = user.lastLoginAt;
    orm.createdAt = user.createdAt;
    orm.emailVerifiedAt = user.emailVerifiedAt;
    orm.pendingEmail = user.pendingEmail;
    return orm;
  },
};
