import { NestLoggerAdapter } from '@shared/infrastructure/logging/nest-logger.adapter';
import { SystemClock } from '@shared/infrastructure/system/system-clock';
import { InternalHttpModule } from '@shared/infrastructure/http';
import {
  registerBullConnection,
  registerNotificationsQueue,
} from '@shared/infrastructure/messaging';
import { AppConfigModule } from '@shared/infrastructure/config';
import { registerDatabase } from '@shared/infrastructure/persistence';
import { SharedAuthModule } from '@shared/presentation/auth';
import { BusinessErrorsFilter } from '@shared/presentation/http';
import { HealthModule, provideAll, TokenRevocationModule } from '@shared/bootstrap';
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  APPOINTMENT_REPOSITORY,
  AVAILABILITY_CACHE,
  CAMPAIGN_REPOSITORY,
  CLOCK,
  CONFIRMATION_TOKEN_SERVICE,
  ELIGIBILITY_GATEWAY,
  LOGGER,
  NOTIFICATION_PUBLISHER,
  OUTBOX_REPOSITORY,
  COLLECTION_UNIT_REPOSITORY,
  UNIT_OF_WORK,
} from './application/ports';
import { AttendanceConfirmationService } from './application/services/attendance-confirmation.service';
import { AppointmentNotificationsService } from './application/services/appointment-notifications.service';
import { FindAppointmentUseCase } from './application/use-cases/appointment/find-appointment.use-case';
import { CancelAppointmentUseCase } from './application/use-cases/appointment/cancel-appointment.use-case';
import { CancelDonorAppointmentsUseCase } from './application/use-cases/appointment/cancel-donor-appointments.use-case';
import { FindDonorsWithOpenAppointmentUseCase } from './application/use-cases/appointment/find-donors-with-open-appointment.use-case';
import { CompleteAppointmentUseCase } from './application/use-cases/appointment/complete-appointment.use-case';
import { ConfirmAttendanceByTokenUseCase } from './application/use-cases/appointment/confirm-attendance-by-token.use-case';
import { ConfirmAttendanceUseCase } from './application/use-cases/appointment/confirm-attendance.use-case';
import { CheckAvailabilityUseCase } from './application/use-cases/appointment/check-availability.use-case';
import { CreateAppointmentUseCase } from './application/use-cases/appointment/create-appointment.use-case';
import { ListDonorAppointmentsUseCase } from './application/use-cases/appointment/list-donor-appointments.use-case';
import { ListAppointmentsUseCase } from './application/use-cases/appointment/list-appointments.use-case';
import { MarkNoShowUseCase } from './application/use-cases/appointment/mark-no-show.use-case';
import { PerformCheckinUseCase } from './application/use-cases/appointment/perform-checkin.use-case';
import { FindCampaignUseCase } from './application/use-cases/campaign/find-campaign.use-case';
import { CreateCampaignUseCase } from './application/use-cases/campaign/create-campaign.use-case';
import { DeactivateCampaignUseCase } from './application/use-cases/campaign/deactivate-campaign.use-case';
import { ListActiveCampaignsUseCase } from './application/use-cases/campaign/list-active-campaigns.use-case';
import { DispatchOutboxUseCase } from './application/use-cases/outbox/dispatch-outbox.use-case';
import { ListOutboxFailuresUseCase } from './application/use-cases/outbox/list-outbox-failures.use-case';
import { ReconcileOutboxUseCase } from './application/use-cases/outbox/reconcile-outbox.use-case';
import { ReprocessEventOutboxUseCase } from './application/use-cases/outbox/reprocess-event-outbox.use-case';
import { FindCollectionUnitUseCase } from './application/use-cases/collection-unit/find-collection-unit.use-case';
import { CreateCollectionUnitUseCase } from './application/use-cases/collection-unit/create-collection-unit.use-case';
import { DeactivateCollectionUnitUseCase } from './application/use-cases/collection-unit/deactivate-collection-unit.use-case';
import { ListActiveUnitsUseCase } from './application/use-cases/collection-unit/list-active-units.use-case';
import { ListUnitsUseCase } from './application/use-cases/collection-unit/list-units.use-case';
import { ReactivateCollectionUnitUseCase } from './application/use-cases/collection-unit/reactivate-collection-unit.use-case';
import { RedisAvailabilityCache } from './infrastructure/cache/redis-availability-cache';
import { EligibilityHttpGateway } from './infrastructure/external/eligibility-http.gateway';
import { NotificationQueuePublisher } from './infrastructure/external/notification-queue.publisher';
import { OutboxDispatcherJob } from './infrastructure/jobs/outbox-dispatcher.job';
import { OutboxReconciliationJob } from './infrastructure/jobs/outbox-reconciliation.job';
import { MIGRATIONS } from './infrastructure/persistence/migrations';
import { ORM_ENTITIES } from './infrastructure/persistence/orm-entities';
import { AppointmentTypeOrmRepository } from './infrastructure/persistence/repositories/appointment.typeorm-repository';
import { CampaignTypeOrmRepository } from './infrastructure/persistence/repositories/campaign.typeorm-repository';
import { OutboxTypeOrmRepository } from './infrastructure/persistence/repositories/outbox.typeorm-repository';
import { CollectionUnitTypeOrmRepository } from './infrastructure/persistence/repositories/collection-unit.typeorm-repository';
import { TypeOrmUnitOfWork } from './infrastructure/persistence/typeorm-unit-of-work';
import { HmacConfirmationTokenService } from './infrastructure/security/hmac-confirmation-token.service';
import { AppointmentsController } from './presentation/http/controllers/appointments.controller';
import { InternalAppointmentsController } from './presentation/http/controllers/internal-appointments.controller';
import { CampaignsController } from './presentation/http/controllers/campaigns.controller';
import { AttendanceConfirmationController } from './presentation/http/controllers/attendance-confirmation.controller';
import { OutboxController } from './presentation/http/controllers/outbox.controller';
import { CollectionUnitsController } from './presentation/http/controllers/collection-units.controller';
import { SCHEDULING_ERROR_STATUS } from './presentation/http/error-status';

/** Casos de uso e serviços de aplicação (só dependem das portas). */
const APPLICATION_PROVIDERS = [
  AppointmentNotificationsService,
  AttendanceConfirmationService,
  CreateAppointmentUseCase,
  FindAppointmentUseCase,
  ListDonorAppointmentsUseCase,
  ListAppointmentsUseCase,
  CheckAvailabilityUseCase,
  CancelAppointmentUseCase,
  CancelDonorAppointmentsUseCase,
  FindDonorsWithOpenAppointmentUseCase,
  ConfirmAttendanceUseCase,
  ConfirmAttendanceByTokenUseCase,
  PerformCheckinUseCase,
  MarkNoShowUseCase,
  CompleteAppointmentUseCase,
  CreateCampaignUseCase,
  FindCampaignUseCase,
  ListActiveCampaignsUseCase,
  DeactivateCampaignUseCase,
  CreateCollectionUnitUseCase,
  FindCollectionUnitUseCase,
  ListActiveUnitsUseCase,
  ListUnitsUseCase,
  DeactivateCollectionUnitUseCase,
  ReactivateCollectionUnitUseCase,
  DispatchOutboxUseCase,
  ReconcileOutboxUseCase,
  ListOutboxFailuresUseCase,
  ReprocessEventOutboxUseCase,
];

/** Cada porta da aplicação ligada ao seu adaptador de infraestrutura. */
const PORT_ADAPTERS = [
  { provide: APPOINTMENT_REPOSITORY, useClass: AppointmentTypeOrmRepository },
  { provide: COLLECTION_UNIT_REPOSITORY, useClass: CollectionUnitTypeOrmRepository },
  { provide: CAMPAIGN_REPOSITORY, useClass: CampaignTypeOrmRepository },
  { provide: OUTBOX_REPOSITORY, useClass: OutboxTypeOrmRepository },
  { provide: UNIT_OF_WORK, useClass: TypeOrmUnitOfWork },
  { provide: AVAILABILITY_CACHE, useClass: RedisAvailabilityCache },
  { provide: ELIGIBILITY_GATEWAY, useClass: EligibilityHttpGateway },
  { provide: NOTIFICATION_PUBLISHER, useClass: NotificationQueuePublisher },
  { provide: CONFIRMATION_TOKEN_SERVICE, useClass: HmacConfirmationTokenService },
  { provide: CLOCK, useClass: SystemClock },
  { provide: LOGGER, useFactory: () => new NestLoggerAdapter() },
];

@Module({
  imports: [
    AppConfigModule,
    HealthModule.register({ database: true, redis: true }),
    TokenRevocationModule,
    registerDatabase('scheduling', ORM_ENTITIES, MIGRATIONS),
    TypeOrmModule.forFeature(ORM_ENTITIES),
    SharedAuthModule,
    InternalHttpModule,
    registerBullConnection(),
    registerNotificationsQueue(),
  ],
  controllers: [
    CollectionUnitsController,
    CampaignsController,
    InternalAppointmentsController,
    AppointmentsController,
    AttendanceConfirmationController,
    OutboxController,
  ],
  providers: [
    ...provideAll(APPLICATION_PROVIDERS),
    ...PORT_ADAPTERS,
    OutboxDispatcherJob,
    OutboxReconciliationJob,
    { provide: APP_FILTER, useValue: new BusinessErrorsFilter(SCHEDULING_ERROR_STATUS) },
  ],
})
export class AppModule {}
