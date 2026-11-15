import { bootstrapService } from '@shared/bootstrap';
import { AppModule } from './app.module';

/**
 * notification-service: no fundo, um worker BullMQ que consome a fila "notifications" (ver
 * NotificationsModule). O HTTP expõe /health (usado pelo docker-compose), o acompanhamento dos
 * e-mails para o admin (GET /notifications/...) e o webhook do provedor de e-mail.
 */
bootstrapService({
  module: AppModule,
  name: 'notification-service',
  description:
    'Worker BullMQ de e-mails; expõe o acompanhamento dos envios (admin) e o webhook do provedor',
  portEnvVar: 'NOTIFICATION_SERVICE_PORT',
  defaultPort: 3004,
  // Atrás do gateway: o IP real do cliente vem no X-Forwarded-For (limite de requisições por IP).
  trustProxy: 1,
  startMessage: (port) =>
    `notification-service rodando na porta ${port} (worker BullMQ consumindo a fila "notifications"; saúde em /health)`,
});
