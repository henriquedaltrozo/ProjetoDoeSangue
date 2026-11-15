import { ErasedSubjectOrmEntity } from './infrastructure/persistence/orm-entities/erased-subject.orm-entity';
import { provideAll } from '@shared/bootstrap';
import { LOGGER } from '@shared/application/ports';
import { NestLoggerAdapter } from '@shared/infrastructure/logging/nest-logger.adapter';
import {
  registerBullConnection,
  registerNotificationsQueue,
} from '@shared/infrastructure/messaging';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TEMPLATE_CONTEXT, type TemplateContext } from './application/ports/template-context.port';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MAIL_SENDER } from './application/ports/mail-sender.port';
import { SUPPRESSION_LIST } from './application/ports/suppression-list.port';
import { SuppressedRecipientOrmEntity } from './infrastructure/persistence/orm-entities/suppressed-recipient.orm-entity';
import { SuppressionListTypeOrmRepository } from './infrastructure/persistence/repositories/suppression-list.typeorm-repository';
import { EmailNotifier } from './application/services/email-notifier';
import { DispatchNotificationUseCase } from './application/use-cases/dispatch-notification.use-case';
import { ErasePersonalDataUseCase } from './application/use-cases/erase-personal-data.use-case';
import { PurgeNotificationLogsUseCase } from './application/use-cases/purge-notification-logs.use-case';
import {
  ListFailedJobsUseCase,
  ListSentNotificationsUseCase,
  ListSuppressedUseCase,
  RemoveSuppressedUseCase,
  RetryFailedJobUseCase,
} from './application/use-cases/notifications-admin.use-cases';
import { RegisterMailEventsUseCase } from './application/use-cases/register-mail-events.use-case';
import { FAILED_JOBS } from './application/ports/failed-jobs.port';
import { UNSUBSCRIBE_LINKS } from './application/ports/unsubscribe-links.port';
import { SignedUnsubscribeLinks } from './infrastructure/security/signed-unsubscribe-links';
import { BullMqFailedJobs } from './infrastructure/queue/bullmq-failed-jobs';
import { NotificationsAdminController } from './presentation/http/notifications-admin.controller';
import { MailEventsWebhookController } from './presentation/http/mail-events-webhook.controller';
import { BusinessErrorsFilter } from '@shared/presentation/http';
import { APP_FILTER } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { NotificationLogCleanupJob } from './infrastructure/jobs/notification-log-cleanup.job';
import { NOTIFICATION_LOG_REPOSITORY } from './application/ports/notification-log.repository';
import { NodemailerMailSender } from './infrastructure/mail/nodemailer-mail-sender';
import { NotificationLogOrmEntity } from './infrastructure/persistence/orm-entities/notification-log.orm-entity';
import { NotificationLogTypeOrmRepository } from './infrastructure/persistence/repositories/notification-log.typeorm-repository';
import { NotificationsProcessor } from './presentation/queue/notifications.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationLogOrmEntity,
      ErasedSubjectOrmEntity,
      SuppressedRecipientOrmEntity,
    ]),
    registerBullConnection(),
    registerNotificationsQueue(),
    // Limite por IP no webhook do provedor de e-mail (rota pública).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
  ],
  controllers: [NotificationsAdminController, MailEventsWebhookController],
  providers: [
    { provide: NOTIFICATION_LOG_REPOSITORY, useClass: NotificationLogTypeOrmRepository },
    { provide: MAIL_SENDER, useClass: NodemailerMailSender },
    { provide: SUPPRESSION_LIST, useClass: SuppressionListTypeOrmRepository },
    { provide: FAILED_JOBS, useClass: BullMqFailedJobs },
    { provide: UNSUBSCRIBE_LINKS, useClass: SignedUnsubscribeLinks },
    { provide: APP_FILTER, useValue: new BusinessErrorsFilter() },
    {
      provide: TEMPLATE_CONTEXT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): TemplateContext => ({
        frontendUrl: config
          .get<string>('FRONTEND_URL', 'http://localhost:5173')
          .replace(/\/+$/, ''),
      }),
    },
    { provide: LOGGER, useFactory: () => new NestLoggerAdapter('Notifications') },
    ...provideAll([
      EmailNotifier,
      DispatchNotificationUseCase,
      ErasePersonalDataUseCase,
      PurgeNotificationLogsUseCase,
      ListSentNotificationsUseCase,
      ListFailedJobsUseCase,
      RetryFailedJobUseCase,
      ListSuppressedUseCase,
      RemoveSuppressedUseCase,
      RegisterMailEventsUseCase,
    ]),
    NotificationsProcessor,
    NotificationLogCleanupJob,
  ],
})
export class NotificationsModule {}
