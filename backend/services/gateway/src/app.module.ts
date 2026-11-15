import { AppConfigModule } from '@shared/infrastructure/config';
import { HealthModule } from '@shared/bootstrap';
import { Module } from '@nestjs/common';

/**
 * Módulo raiz do gateway. Não define rotas de negócio próprias além de
 * /health, que faz ping HTTP no /health de cada serviço de destino - o
 * roteamento por reverse proxy (auth/eligibility/scheduling) é montado em
 * main.ts via http-proxy-middleware (ver infrastructure/gateway/proxy/proxy-routes.ts).
 */
@Module({
  imports: [
    AppConfigModule,
    HealthModule.register({
      services: [
        { name: 'auth-service', urlEnvVar: 'AUTH_SERVICE_URL' },
        { name: 'eligibility-service', urlEnvVar: 'ELIGIBILITY_SERVICE_URL' },
        { name: 'scheduling-service', urlEnvVar: 'SCHEDULING_SERVICE_URL' },
        { name: 'notification-service', urlEnvVar: 'NOTIFICATION_SERVICE_URL' },
      ],
    }),
  ],
})
export class AppModule {}
