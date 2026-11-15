import { ConfigService } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { blockInternalRoutes } from './internal-routes';
import { PROXY_ROUTES } from './proxy-routes';

/**
 * Adaptador de saída do gateway: monta um reverse proxy (http-proxy-middleware) para cada rota
 * da tabela de roteamento (ver proxy-routes.ts).
 */
export function buildProxies(app: INestApplication, config: ConfigService): void {
  // Rotas internas (serviço a serviço) nunca saem pelo gateway público.
  app.use(blockInternalRoutes);
  for (const route of PROXY_ROUTES) {
    const target = config.getOrThrow<string>(route.targetEnvVar);
    app.use(
      route.prefix,
      createProxyMiddleware({
        target,
        changeOrigin: true,
        // Repassa o IP real do cliente (X-Forwarded-For) para o rate limit do auth-service.
        xfwd: true,
        // Express já removeu o prefixo de montagem de req.url antes de chamar
        // este middleware - devolvemos ele aqui para o serviço de destino
        // receber o path completo original (@Controller(route.prefix) em
        // cada serviço espera o prefixo).
        pathRewrite: (path) => `${route.prefix}${path}`,
      }),
    );
  }
}
