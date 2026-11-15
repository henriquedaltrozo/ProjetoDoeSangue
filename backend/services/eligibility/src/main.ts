import { bootstrapService } from '@shared/bootstrap';
import { AppModule } from './app.module';

bootstrapService({
  module: AppModule,
  name: 'eligibility-service',
  description: 'Cadastro de doadores e motor de regras de elegibilidade',
  portEnvVar: 'ELIGIBILITY_SERVICE_PORT',
  defaultPort: 3002,
  // Atrás do gateway: o IP real do cliente vem no X-Forwarded-For (limite de requisições por IP).
  trustProxy: 1,
});
