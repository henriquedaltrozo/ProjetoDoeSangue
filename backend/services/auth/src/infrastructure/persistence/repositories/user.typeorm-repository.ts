import { Role } from '@shared/domain/enums';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, LessThan, Repository } from 'typeorm';
import { UserRepository } from '../../../application/ports/user.repository';
import { User } from '../../../domain/entities/user';
import { UserMapper } from '../mappers/user.mapper';
import { UserOrmEntity } from '../orm-entities/user.orm-entity';
import { emailIndex, isUniqueViolation } from '@shared/infrastructure/persistence';
import { ConflictError } from '../../../application/errors';

@Injectable()
export class UserTypeOrmRepository implements UserRepository {
  constructor(@InjectRepository(UserOrmEntity) private readonly repo: Repository<UserOrmEntity>) {}

  private async one(where: FindOptionsWhere<UserOrmEntity>): Promise<User | null> {
    const orm = await this.repo.findOne({ where });
    return orm ? UserMapper.toDomain(orm) : null;
  }

  findById(id: string): Promise<User | null> {
    return this.one({ id });
  }

  /**
   * O e-mail fica cifrado: a busca compara o índice cego do e-mail normalizado (sem diferenciar
   * maiúsculas nem espaços nas pontas), então "Maria@X.com" encontra a conta de "maria@x.com".
   */
  findByEmail(email: string): Promise<User | null> {
    return this.one({ emailIndex: emailIndex(email) });
  }

  findAdminById(id: string): Promise<User | null> {
    return this.one({ id, role: Role.ADMIN });
  }

  async listAdmins(): Promise<User[]> {
    const admins = await this.repo.find({
      where: { role: Role.ADMIN },
      order: { createdAt: 'ASC' },
    });
    return admins.map(UserMapper.toDomain);
  }

  countAdmins(): Promise<number> {
    return this.repo.count({ where: { role: Role.ADMIN } });
  }

  countAdminsActive(): Promise<number> {
    return this.repo.count({ where: { role: Role.ADMIN, active: true } });
  }

  /** Advisory lock do Postgres escopado à transação (liberado no commit/rollback). */
  async lockAdmins(): Promise<void> {
    await this.repo.query(`SELECT pg_advisory_xact_lock(hashtext('auth:admins'))`);
  }

  async listPendingDonors(createdBefore: Date, limit: number): Promise<User[]> {
    const pending = await this.repo.find({
      where: {
        role: Role.DONOR,
        donorId: IsNull(),
        active: true,
        createdAt: LessThan(createdBefore),
      },
      order: { createdAt: 'ASC' },
      take: limit,
    });
    return pending.map(UserMapper.toDomain);
  }

  async save(user: User): Promise<void> {
    try {
      await this.repo.save(UserMapper.toOrm(user));
    } catch (err) {
      // Dois cadastros simultâneos com o mesmo e-mail: o índice único decide quem fica.
      if (isUniqueViolation(err)) throw new ConflictError('E-mail já cadastrado.');
      throw err;
    }
  }

  async saveLoginState(user: User): Promise<void> {
    await this.repo.update(
      { id: user.id },
      {
        loginFailures: user.loginFailures,
        blockedUntil: user.blockedUntil,
        lastLoginAt: user.lastLoginAt,
      },
    );
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
