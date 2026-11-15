import { securityHeadersMiddleware } from '../presentation/http';
import { AppLogger, createRequestLoggingMiddleware } from '../infrastructure/observability';
import { INestApplication, Type, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Swagger (/docs) expõe o mapa completo da API, então fica desligado em produção.
 * `SWAGGER_ENABLED=true|false` força o valor; sem ele, liga fora de produção.
 */
export function isSwaggerEnabled(env: { NODE_ENV?: string; SWAGGER_ENABLED?: string }): boolean {
  if (env.SWAGGER_ENABLED === 'true') return true;
  if (env.SWAGGER_ENABLED === 'false') return false;
  return env.NODE_ENV !== 'production';
}

export interface BootstrapServiceOptions {
  /** Módulo raiz (AppModule) do serviço. */
  module: Type<unknown>;
  /** Nome do serviço: usado no logger, no log de acesso e no título do Swagger. */
  name: string;
  /** Descrição exibida no Swagger. */
  description: string;
  /** Variável de ambiente com a porta (ex.: AUTH_SERVICE_PORT) e o valor padrão. */
  portEnvVar: string;
  defaultPort: number;
  /** Mensagem exibida ao subir; por padrão, "<name> rodando na porta N (Swagger em /docs)". */
  startMessage?: (port: number) => string;
  /** Liga o ValidationPipe global (padrão: true). O gateway não usa. */
  validation?: boolean;
  /** Adiciona o esquema Bearer ao Swagger (padrão: true). */
  bearerAuth?: boolean;
  /** Desliga o bodyParser do Nest (necessário no gateway, que faz proxy do corpo). */
  bodyParser?: boolean;
  /**
   * Quantos proxies confiáveis ficam na frente do serviço (ex.: 1 para serviços atrás do
   * gateway). Define `trust proxy` do Express, para `req.ip` refletir o cliente real
   * (rate limit). Pode ser sobrescrito por `TRUST_PROXY_HOPS`.
   */
  trustProxy?: number;
  /** Ajustes específicos do serviço, executados antes do Swagger (CORS, proxies etc.). */
  configure?: (app: INestApplication, config: ConfigService) => void;
}

/**
 * Bootstrap comum dos 5 serviços: logger e log de acesso (x-request-id),
 * validação global, Swagger em /docs e listen na porta configurada.
 */
export async function bootstrapService(options: BootstrapServiceOptions): Promise<void> {
  const { module, name, description, portEnvVar, defaultPort } = options;

  const app = await NestFactory.create(
    module,
    options.bodyParser === false ? { bodyParser: false, bufferLogs: true } : { bufferLogs: true },
  );
  app.useLogger(new AppLogger(name));
  // No `docker stop` (SIGTERM), fecha conexões, filas e timers (onModuleDestroy) antes de sair, em
  // vez de interromper o processo no meio de um envio.
  app.enableShutdownHooks();
  const config = app.get(ConfigService);
  const hops = Number(config.get('TRUST_PROXY_HOPS') ?? options.trustProxy ?? 0);
  if (hops > 0) {
    app.getHttpAdapter().getInstance().set('trust proxy', hops);
  }
  app.use(securityHeadersMiddleware);
  app.use(createRequestLoggingMiddleware(name));

  if (options.validation !== false) {
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
  }

  options.configure?.(app, config);

  const swaggerOn = isSwaggerEnabled({
    NODE_ENV: config.get<string>('NODE_ENV'),
    SWAGGER_ENABLED: config.get<string>('SWAGGER_ENABLED'),
  });
  if (swaggerOn) {
    const swagger = new DocumentBuilder()
      .setTitle(name)
      .setDescription(description)
      .setVersion('1.0');
    if (options.bearerAuth !== false) {
      swagger.addBearerAuth();
    }
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger.build()));
  }

  const port = config.get<number>(portEnvVar, defaultPort);
  await app.listen(port);
  console.log(
    options.startMessage?.(port) ??
      `${name} rodando na porta ${port}${swaggerOn ? ' (Swagger em /docs)' : ''}`,
  );
}
