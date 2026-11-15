import { CLOCK, LOGGER } from '@shared/application/ports';
import { NestLoggerAdapter } from '@shared/infrastructure/logging/nest-logger.adapter';
import { SystemClock } from '@shared/infrastructure/system/system-clock';
import {
  registerBullConnection,
  registerNotificationsQueue,
} from '@shared/infrastructure/messaging';
import { InternalHttpModule } from '@shared/infrastructure/http';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AUDIT_REPOSITORY } from './application/ports/audit.repository';
import { ASSESSMENT_REPOSITORY } from './application/ports/assessment.repository';
import { DONOR_REPOSITORY } from './application/ports/donor.repository';
import { NOTIFICATION_PUBLISHER } from './application/ports/notification.publisher';
import { UNFITNESS_REPOSITORY } from './application/ports/unfitness.repository';
import { NotificationQueuePublisher } from './infrastructure/messaging/notification-queue.publisher';
import { UNSUBSCRIBE_TOKENS } from './application/ports/unsubscribe-tokens.port';
import { SCHEDULING_GATEWAY } from './application/ports/scheduling.gateway';
import { SchedulingHttpGateway } from './infrastructure/external/scheduling-http.gateway';
import { SignedUnsubscribeTokens } from './infrastructure/security/signed-unsubscribe-tokens';
import { AccessAuditOrmEntity } from './infrastructure/persistence/orm-entities/access-audit.orm-entity';
import { EligibilityAssessmentOrmEntity } from './infrastructure/persistence/orm-entities/assessment-eligibility.orm-entity';
import { DonorOrmEntity } from './infrastructure/persistence/orm-entities/donor.orm-entity';
import { TemporaryUnfitnessOrmEntity } from './infrastructure/persistence/orm-entities/temporary-unfitness.orm-entity';
import { AuditTypeOrmRepository } from './infrastructure/persistence/repositories/audit.typeorm-repository';
import { AssessmentTypeOrmRepository } from './infrastructure/persistence/repositories/assessment.typeorm-repository';
import { DonorTypeOrmRepository } from './infrastructure/persistence/repositories/donor.typeorm-repository';
import { UnfitnessTypeOrmRepository } from './infrastructure/persistence/repositories/unfitness.typeorm-repository';

/** Liga as portas da aplicação aos adaptadores (TypeORM, relógio do sistema, logger do Nest). */
@Module({
  imports: [
    registerBullConnection(),
    registerNotificationsQueue(),
    InternalHttpModule,
    TypeOrmModule.forFeature([
      DonorOrmEntity,
      TemporaryUnfitnessOrmEntity,
      EligibilityAssessmentOrmEntity,
      AccessAuditOrmEntity,
    ]),
  ],
  providers: [
    { provide: DONOR_REPOSITORY, useClass: DonorTypeOrmRepository },
    { provide: UNFITNESS_REPOSITORY, useClass: UnfitnessTypeOrmRepository },
    { provide: ASSESSMENT_REPOSITORY, useClass: AssessmentTypeOrmRepository },
    { provide: AUDIT_REPOSITORY, useClass: AuditTypeOrmRepository },
    { provide: NOTIFICATION_PUBLISHER, useClass: NotificationQueuePublisher },
    { provide: UNSUBSCRIBE_TOKENS, useClass: SignedUnsubscribeTokens },
    { provide: SCHEDULING_GATEWAY, useClass: SchedulingHttpGateway },
    { provide: CLOCK, useClass: SystemClock },
    { provide: LOGGER, useFactory: () => new NestLoggerAdapter('AuditService') },
  ],
  exports: [
    DONOR_REPOSITORY,
    UNFITNESS_REPOSITORY,
    ASSESSMENT_REPOSITORY,
    AUDIT_REPOSITORY,
    NOTIFICATION_PUBLISHER,
    UNSUBSCRIBE_TOKENS,
    SCHEDULING_GATEWAY,
    CLOCK,
    LOGGER,
  ],
})
export class InfrastructureModule {}
