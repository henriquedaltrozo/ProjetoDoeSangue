import { AppConfigModule } from '@shared/infrastructure/config';
import { registerDatabase } from '@shared/infrastructure/persistence';
import { SharedAuthModule } from '@shared/presentation/auth';
import { BusinessErrorsFilter } from '@shared/presentation/http';
import { HealthModule, provideAll, TokenRevocationModule } from '@shared/bootstrap';
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AnonymizeDataUseCase } from './application/use-cases/anonymize-data.use-case';
import { UpdateDonorUseCase } from './application/use-cases/update-donor.use-case';
import { UpdateDonorIdentityUseCase } from './application/use-cases/update-donor-identity.use-case';
import { AssessEligibilityUseCase } from './application/use-cases/assess-eligibility.use-case';
import { FindDonorByIdUseCase } from './application/use-cases/find-donor-by-id.use-case';
import { FindDonorByUserUseCase } from './application/use-cases/find-donor-by-user.use-case';
import { FindDonorsUseCase } from './application/use-cases/find-donors.use-case';
import { CompleteDonationUseCase } from './application/use-cases/complete-donation.use-case';
import { CreateDonorUseCase } from './application/use-cases/create-donor.use-case';
import { EndUnfitnessUseCase } from './application/use-cases/end-unfitness.use-case';
import { DeleteUnfitnessUseCase } from './application/use-cases/delete-unfitness.use-case';
import { ExportDataUseCase } from './application/use-cases/export-data.use-case';
import { EligibilityHistoryUseCase } from './application/use-cases/eligibility-history.use-case';
import { ListAuditUseCase } from './application/use-cases/list-audit.use-case';
import { ListContactsUseCase } from './application/use-cases/list-contacts.use-case';
import { FindDonorContactUseCase } from './application/use-cases/find-donor-contact.use-case';
import { NotifyEligibleAgainUseCase } from './application/use-cases/notify-eligible-again.use-case';
import { UnsubscribeAlertsUseCase } from './application/use-cases/unsubscribe-alerts.use-case';
import { AlertsUnsubscribeController } from './presentation/http/controllers/alerts-unsubscribe.controller';
import { EligibleAgainJob } from './infrastructure/jobs/eligible-again.job';
import { ListUnfitnessUseCase } from './application/use-cases/list-unfitness.use-case';
import { RegisterMedicalClearanceUseCase } from './application/use-cases/register-medical-clearance.use-case';
import { RegisterTemporaryUnfitnessUseCase } from './application/use-cases/register-temporary-unfitness.use-case';
import { RevokeMedicalClearanceUseCase } from './application/use-cases/revoke-medical-clearance.use-case';
import { RegisterPermanentUnfitnessUseCase } from './application/use-cases/register-permanent-unfitness.use-case';
import { RevokePermanentUnfitnessUseCase } from './application/use-cases/revoke-permanent-unfitness.use-case';
import { InfrastructureModule } from './infrastructure.module';
import { MIGRATIONS } from './infrastructure/persistence/migrations';
import { AccessAuditOrmEntity } from './infrastructure/persistence/orm-entities/access-audit.orm-entity';
import { EligibilityAssessmentOrmEntity } from './infrastructure/persistence/orm-entities/assessment-eligibility.orm-entity';
import { DonorOrmEntity } from './infrastructure/persistence/orm-entities/donor.orm-entity';
import { TemporaryUnfitnessOrmEntity } from './infrastructure/persistence/orm-entities/temporary-unfitness.orm-entity';
import { DonorsController } from './presentation/http/controllers/donors.controller';
import { InternalDonorsController } from './presentation/http/controllers/donors-internal.controller';
import { AuditTrail } from './application/services/audit-trail';
import { EligibilityController } from './presentation/http/controllers/eligibility.controller';
import { InternalEligibilityController } from './presentation/http/controllers/eligibility-internal.controller';

/** Casos de uso e serviços de aplicação (só dependem das portas). */
const USE_CASES = [
  AuditTrail,
  CreateDonorUseCase,
  FindDonorByIdUseCase,
  FindDonorByUserUseCase,
  UpdateDonorUseCase,
  UpdateDonorIdentityUseCase,
  ListContactsUseCase,
  FindDonorContactUseCase,
  NotifyEligibleAgainUseCase,
  UnsubscribeAlertsUseCase,
  FindDonorsUseCase,
  RegisterTemporaryUnfitnessUseCase,
  ListUnfitnessUseCase,
  EndUnfitnessUseCase,
  DeleteUnfitnessUseCase,
  CompleteDonationUseCase,
  ExportDataUseCase,
  AnonymizeDataUseCase,
  ListAuditUseCase,
  AssessEligibilityUseCase,
  EligibilityHistoryUseCase,
  RegisterMedicalClearanceUseCase,
  RevokeMedicalClearanceUseCase,
  RegisterPermanentUnfitnessUseCase,
  RevokePermanentUnfitnessUseCase,
];

/** Raiz de composição: liga controllers, casos de uso e adaptadores de infraestrutura. */
@Module({
  imports: [
    AppConfigModule,
    HealthModule.register({ database: true }),
    TokenRevocationModule,
    registerDatabase(
      'eligibility',
      [
        DonorOrmEntity,
        TemporaryUnfitnessOrmEntity,
        EligibilityAssessmentOrmEntity,
        AccessAuditOrmEntity,
      ],
      MIGRATIONS,
    ),
    InfrastructureModule,
    SharedAuthModule,
    // Limite por IP nas rotas públicas que o usam (ex.: descadastro dos avisos).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 60 }]),
  ],
  // Os internos vêm antes: `GET /donors/internal/...` precisa casar antes de `GET /donors/:id`.
  controllers: [
    InternalDonorsController,
    InternalEligibilityController,
    AlertsUnsubscribeController,
    DonorsController,
    EligibilityController,
  ],
  providers: [
    ...provideAll(USE_CASES),
    EligibleAgainJob,
    { provide: APP_FILTER, useValue: new BusinessErrorsFilter() },
  ],
})
export class AppModule {}
