import { bootstrapService } from '@shared/bootstrap';
import { AppModule } from './app.module';

bootstrapService({
  module: AppModule,
  name: 'auth-service',
  description: 'Autenticação, cadastro de usuários e emissão de JWT',
  portEnvVar: 'AUTH_SERVICE_PORT',
  defaultPort: 3001,
  // Fica atrás do gateway: o IP real do cliente vem no X-Forwarded-For (rate limit do login).
  trustProxy: 1,
});
