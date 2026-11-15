import { bootstrapService } from '@shared/bootstrap';
import { AppModule } from './app.module';

/**
 * Bootstrap do scheduling-service - agenda de coletas, unidades, campanhas,
 * integração síncrona com o eligibility-service e cache de disponibilidade
 * em Redis (ver AppModule e services/scheduling/src/application/use-cases/appointment/create-appointment.use-case.ts).
 */
bootstrapService({
  module: AppModule,
  name: 'scheduling-service',
  description: 'Agenda de coletas, unidades e campanhas',
  portEnvVar: 'SCHEDULING_SERVICE_PORT',
  defaultPort: 3003,
});
