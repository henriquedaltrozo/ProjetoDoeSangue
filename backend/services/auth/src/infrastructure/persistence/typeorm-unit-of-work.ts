import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TransactionalContext, UnitOfWork } from '../../application/ports/unit-of-work.port';
import { AccountNoticeOrmEntity } from './orm-entities/account-notice.orm-entity';
import { PasswordResetTokenOrmEntity } from './orm-entities/password-reset-token.orm-entity';
import { RefreshTokenOrmEntity } from './orm-entities/refresh-token.orm-entity';
import { UserOrmEntity } from './orm-entities/user.orm-entity';
import { AccountNoticeTypeOrmRepository } from './repositories/account-notice.typeorm-repository';
import { PasswordResetTokenTypeOrmRepository } from './repositories/password-reset-token.typeorm-repository';
import { RefreshTokenTypeOrmRepository } from './repositories/refresh-token.typeorm-repository';
import { UserTypeOrmRepository } from './repositories/user.typeorm-repository';

/** Transação TypeORM: os repositórios compartilham o mesmo EntityManager. */
@Injectable()
export class TypeOrmUnitOfWork implements UnitOfWork {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  run<T>(work: (tx: TransactionalContext) => Promise<T>): Promise<T> {
    return this.dataSource.transaction((manager) =>
      work({
        users: new UserTypeOrmRepository(manager.getRepository(UserOrmEntity)),
        refreshTokens: new RefreshTokenTypeOrmRepository(
          manager.getRepository(RefreshTokenOrmEntity),
        ),
        resetTokens: new PasswordResetTokenTypeOrmRepository(
          manager.getRepository(PasswordResetTokenOrmEntity),
        ),
        accountNotices: new AccountNoticeTypeOrmRepository(
          manager.getRepository(AccountNoticeOrmEntity),
        ),
      }),
    );
  }
}
