import { provideAll } from '@shared/bootstrap';
import { CLOCK, LOGGER } from '@shared/application/ports';
import { NestLoggerAdapter } from '@shared/infrastructure/logging/nest-logger.adapter';
import { SystemClock } from '@shared/infrastructure/system/system-clock';
import { InternalHttpModule } from '@shared/infrastructure/http';
import {
  registerBullConnection,
  registerNotificationsQueue,
} from '@shared/infrastructure/messaging';
import { SharedAuthModule } from '@shared/presentation/auth';
import { BusinessErrorsFilter } from '@shared/presentation/http';
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACCESS_TOKEN_ISSUER } from './application/ports/access-token-issuer.port';
import { AUTH_SETTINGS } from './application/ports/auth-settings.port';
import { ELIGIBILITY_GATEWAY } from './application/ports/eligibility.gateway';
import { ID_GENERATOR } from './application/ports/id-generator.port';
import { NOTIFICATION_PUBLISHER } from './application/ports/notification.publisher';
import { PASSWORD_HASHER } from './application/ports/password-hasher.port';
import { PASSWORD_RESET_TOKEN_REPOSITORY } from './application/ports/password-reset-token.repository';
import { REFRESH_TOKEN_REPOSITORY } from './application/ports/refresh-token.repository';
import { TOKEN_GENERATOR } from './application/ports/token-generator.port';
import { UNIT_OF_WORK } from './application/ports/unit-of-work.port';
import { USER_REPOSITORY } from './application/ports/user.repository';
import { SessionIssuer } from './application/services/session-issuer';
import { DeactivateAdminUseCase } from './application/use-cases/deactivate-admin.use-case';
import { DeleteMyAccountUseCase } from './application/use-cases/delete-my-account.use-case';
import { ExistsAdminUseCase } from './application/use-cases/exists-admin.use-case';
import { ForgotPasswordUseCase } from './application/use-cases/forgot-password.use-case';
import { GetMeUseCase } from './application/use-cases/get-me.use-case';
import { ListAdminsUseCase } from './application/use-cases/list-admins.use-case';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { ReactivateAdminUseCase } from './application/use-cases/reactivate-admin.use-case';
import { RefreshSessionUseCase } from './application/use-cases/refresh-session.use-case';
import { RegisterAdminUseCase } from './application/use-cases/register-admin.use-case';
import { RegisterDonorUseCase } from './application/use-cases/register-donor.use-case';
import { ResetPasswordUseCase } from './application/use-cases/reset-password.use-case';
import { PurgeExpiredTokensUseCase } from './application/use-cases/purge-expired-tokens.use-case';
import { ExpiredTokensCleanupJob } from './infrastructure/jobs/expired-tokens-cleanup.job';
import { AccountNoticesDispatcherJob } from './infrastructure/jobs/account-notices-dispatcher.job';
import { EMAIL_VERIFICATION_TOKENS } from './application/ports/email-verification-tokens.port';
import { VerificationNotices } from './application/services/verification-notices';
import { VerifyEmailUseCase } from './application/use-cases/verify-email.use-case';
import { ResendEmailVerificationUseCase } from './application/use-cases/resend-email-verification.use-case';
import { HmacEmailVerificationTokens } from './infrastructure/security/hmac-email-verification-tokens';
import { DispatchAccountNoticesUseCase } from './application/use-cases/dispatch-account-notices.use-case';
import { UpdateMyAccountUseCase } from './application/use-cases/update-my-account.use-case';
import { ConfigAuthSettings } from './infrastructure/config/config-auth-settings';
import { EligibilityHttpGateway } from './infrastructure/external/eligibility-http.gateway';
import { SchedulingHttpGateway } from './infrastructure/external/scheduling-http.gateway';
import { SCHEDULING_GATEWAY } from './application/ports/scheduling.gateway';
import { NotificationsQueuePublisher } from './infrastructure/external/notifications-queue.publisher';
import { AccountNoticeOrmEntity } from './infrastructure/persistence/orm-entities/account-notice.orm-entity';
import { AccountNoticeTypeOrmRepository } from './infrastructure/persistence/repositories/account-notice.typeorm-repository';
import { ACCOUNT_NOTICE_OUTBOX } from './application/ports/account-notice-outbox';
import { PasswordResetTokenOrmEntity } from './infrastructure/persistence/orm-entities/password-reset-token.orm-entity';
import { RefreshTokenOrmEntity } from './infrastructure/persistence/orm-entities/refresh-token.orm-entity';
import { UserOrmEntity } from './infrastructure/persistence/orm-entities/user.orm-entity';
import { PasswordResetTokenTypeOrmRepository } from './infrastructure/persistence/repositories/password-reset-token.typeorm-repository';
import { RefreshTokenTypeOrmRepository } from './infrastructure/persistence/repositories/refresh-token.typeorm-repository';
import { TypeOrmUnitOfWork } from './infrastructure/persistence/typeorm-unit-of-work';
import { UserTypeOrmRepository } from './infrastructure/persistence/repositories/user.typeorm-repository';
import { BcryptPasswordHasher } from './infrastructure/security/bcrypt-password-hasher';
import { CryptoTokenGenerator } from './infrastructure/security/crypto-token-generator';
import { JwtAccessTokenIssuer } from './infrastructure/security/jwt-access-token-issuer';
import { UuidIdGenerator } from './infrastructure/system/uuid-id-generator';
import { AuthController } from './presentation/http/controllers/auth.controller';
import { AUTH_ERROR_STATUS } from './presentation/http/error-status';
import { ReconcileDonorRegistrationsUseCase } from './application/use-cases/reconcile-donor-registrations.use-case';
import { DonorRegistrationReconciliationJob } from './infrastructure/jobs/donor-registration-reconciliation.job';
import { BootstrapOrAdminGuard } from './presentation/http/guards/bootstrap-or-admin.guard';

/** Módulo de composição: liga cada porta da camada de aplicação ao seu adaptador. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserOrmEntity,
      RefreshTokenOrmEntity,
      PasswordResetTokenOrmEntity,
      AccountNoticeOrmEntity,
    ]),
    SharedAuthModule,
    InternalHttpModule,
    // Só usado (via @UseGuards(ThrottlerGuard) + @Throttle(...) pontuais) nas rotas
    // públicas sensíveis (cadastro, login, refresh, esqueci/redefinir senha, novo admin) -
    // não é um guard global. Ver AuthController.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 20 }]),
    // Fila `notifications` - usada por ForgotPasswordUseCase (via NotificationsQueuePublisher)
    // para enviar o e-mail de redefinição pelo notification-service, em vez de HTTP direto.
    registerBullConnection(),
    registerNotificationsQueue(),
  ],
  controllers: [AuthController],
  providers: [
    // Portas -> adaptadores
    { provide: USER_REPOSITORY, useClass: UserTypeOrmRepository },
    { provide: UNIT_OF_WORK, useClass: TypeOrmUnitOfWork },
    { provide: ACCOUNT_NOTICE_OUTBOX, useClass: AccountNoticeTypeOrmRepository },
    { provide: EMAIL_VERIFICATION_TOKENS, useClass: HmacEmailVerificationTokens },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: RefreshTokenTypeOrmRepository },
    { provide: PASSWORD_RESET_TOKEN_REPOSITORY, useClass: PasswordResetTokenTypeOrmRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: ACCESS_TOKEN_ISSUER, useClass: JwtAccessTokenIssuer },
    { provide: TOKEN_GENERATOR, useClass: CryptoTokenGenerator },
    { provide: ELIGIBILITY_GATEWAY, useClass: EligibilityHttpGateway },
    { provide: SCHEDULING_GATEWAY, useClass: SchedulingHttpGateway },
    { provide: NOTIFICATION_PUBLISHER, useClass: NotificationsQueuePublisher },
    { provide: AUTH_SETTINGS, useClass: ConfigAuthSettings },
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: UuidIdGenerator },
    { provide: LOGGER, useFactory: () => new NestLoggerAdapter('AuthService') },
    // Aplicação
    ...provideAll([
      SessionIssuer,
      RegisterDonorUseCase,
      RegisterAdminUseCase,
      LoginUseCase,
      RefreshSessionUseCase,
      LogoutUseCase,
      GetMeUseCase,
      ExistsAdminUseCase,
      ForgotPasswordUseCase,
      ResetPasswordUseCase,
      DeleteMyAccountUseCase,
      ListAdminsUseCase,
      DeactivateAdminUseCase,
      ReactivateAdminUseCase,
      ReconcileDonorRegistrationsUseCase,
      UpdateMyAccountUseCase,
      PurgeExpiredTokensUseCase,
      DispatchAccountNoticesUseCase,
      VerificationNotices,
      VerifyEmailUseCase,
      ResendEmailVerificationUseCase,
    ]),
    DonorRegistrationReconciliationJob,
    ExpiredTokensCleanupJob,
    AccountNoticesDispatcherJob,
    // Apresentação
    BootstrapOrAdminGuard,
    { provide: APP_FILTER, useValue: new BusinessErrorsFilter(AUTH_ERROR_STATUS) },
  ],
})
export class AuthModule {}
