import { bootstrapService } from '@shared/bootstrap';
import { optionsCors } from '@shared/presentation/http';
import { AppModule } from './app.module';
import { buildProxies } from './infrastructure/proxy/build-proxies';

/**
 * Gateway: reverse proxy puro para auth-service, eligibility-service e
 * scheduling-service (ver infrastructure/gateway/proxy/proxy-routes.ts). Responsabilidade única -
 * roteamento; autenticação/autorização continuam sendo aplicadas em cada
 * serviço via o mesmo JWT_SECRET compartilhado (src/shared/auth), já que
 * o gateway repassa a requisição como recebeu, headers incluídos (o
 * Authorization chega intacto ao serviço de destino).
 *
 * bodyParser fica desligado de propósito: se o Nest consumisse o corpo da
 * requisição antes do proxy, o corpo não chegaria ao serviço de destino
 * (problema clássico de proxy em cima de Express). As rotas do próprio
 * gateway (ex: /health) não têm corpo, então isso não tem custo aqui.
 *
 * O correlation id (x-request-id) e o log de acesso são montados como
 * middleware Express puro (createRequestLoggingMiddleware), não como
 * Interceptor do Nest: o tráfego de negócio deste serviço nunca passa pelo
 * pipeline de Interceptors (é reverse proxy puro, montado abaixo via
 * `app.use()`) - um Interceptor só veria a rota /health. Por isso o
 * middleware precisa ser montado ANTES do loop de proxy, para que o id
 * gerado/propagado aqui já esteja no header quando a requisição chega no
 * serviço de destino.
 */
bootstrapService({
  module: AppModule,
  name: 'gateway',
  description:
    'Porta de entrada única do frontend. Não define rotas de negócio próprias - roteia ' +
    'por prefixo para auth-service, eligibility-service e scheduling-service (ver ' +
    'infrastructure/gateway/proxy/proxy-routes.ts). A documentação de cada rota está no Swagger do respectivo ' +
    'serviço, em /docs de cada um.',
  portEnvVar: 'GATEWAY_PORT',
  defaultPort: 3000,
  validation: false,
  bodyParser: false,
  configure: (app, config) => {
    // CORS restrito às origens do front (CORS_ORIGINS / FRONTEND_URL), com credenciais
    // para o cookie httpOnly do refresh token.
    app.enableCors(optionsCors(config));

    buildProxies(app, config);
  },
});
