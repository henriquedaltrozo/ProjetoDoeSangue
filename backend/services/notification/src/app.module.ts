import { ErasedSubjectOrmEntity } from './infrastructure/persistence/orm-entities/erased-subject.orm-entity';
import { SuppressedRecipientOrmEntity } from './infrastructure/persistence/orm-entities/suppressed-recipient.orm-entity';
import { AppConfigModule } from '@shared/infrastructure/config';
import { registerDatabase } from '@shared/infrastructure/persistence';
import { HealthModule, TokenRevocationModule } from '@shared/bootstrap';
import { SharedAuthModule } from '@shared/presentation/auth';
import { Module } from '@nestjs/common';
import { MIGRATIONS } from './infrastructure/persistence/migrations';
import { NotificationLogOrmEntity } from './infrastructure/persistence/orm-entities/notification-log.orm-entity';
import { NotificationsModule } from './notifications.module';

/**
 * Worker BullMQ da fila "notifications" (e-mails), com Postgres (registro de envios, endereços
 * bloqueados) e Redis. Pelo gateway (prefixo /notifications) expõe só o acompanhamento para o admin
 * (JWT) e o webhook de eventos do provedor de e-mail (segredo na URL). Schema próprio `notification`.
 */
@Module({
  imports: [
    AppConfigModule,
    HealthModule.register({ database: true, redis: true }),
    TokenRevocationModule,
    SharedAuthModule,
    registerDatabase(
      'notification',
      [NotificationLogOrmEntity, ErasedSubjectOrmEntity, SuppressedRecipientOrmEntity],
      MIGRATIONS,
    ),
    NotificationsModule,
  ],
})
export class AppModule {}
