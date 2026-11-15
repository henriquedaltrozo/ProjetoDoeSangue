import { AppConfigModule } from '@shared/infrastructure/config';
import { registerDatabase } from '@shared/infrastructure/persistence';
import { HealthModule, TokenRevocationModule } from '@shared/bootstrap';
import { Module } from '@nestjs/common';
import { AuthModule } from './auth.module';
import { MIGRATIONS } from './infrastructure/persistence/migrations';
import { AccountNoticeOrmEntity } from './infrastructure/persistence/orm-entities/account-notice.orm-entity';
import { PasswordResetTokenOrmEntity } from './infrastructure/persistence/orm-entities/password-reset-token.orm-entity';
import { RefreshTokenOrmEntity } from './infrastructure/persistence/orm-entities/refresh-token.orm-entity';
import { UserOrmEntity } from './infrastructure/persistence/orm-entities/user.orm-entity';

@Module({
  imports: [
    AppConfigModule,
    HealthModule.register({ database: true }),
    TokenRevocationModule,
    registerDatabase(
      'auth',
      [UserOrmEntity, RefreshTokenOrmEntity, PasswordResetTokenOrmEntity, AccountNoticeOrmEntity],
      MIGRATIONS,
    ),
    AuthModule,
  ],
})
export class AppModule {}
