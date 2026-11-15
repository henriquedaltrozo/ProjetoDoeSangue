import { ConfigService } from '@nestjs/config';

const DEFAULT_DEV_ORIGIN = 'http://localhost:5173';

/**
 * Origens autorizadas a chamar a API a partir de um navegador.
 * Lê `CORS_ORIGINS` (lista separada por vírgulas); sem ela, usa `FRONTEND_URL`
 * e, por último, o endereço padrão do front em desenvolvimento.
 */
export function allowedOrigins(config: Pick<ConfigService, 'get'>): string[] {
  const raw = config.get<string>('CORS_ORIGINS') || config.get<string>('FRONTEND_URL');
  const list = (raw ?? DEFAULT_DEV_ORIGIN)
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return list.length ? list : [DEFAULT_DEV_ORIGIN];
}

/** Opções do `app.enableCors`: só as origens permitidas, com credenciais (cookie do refresh token). */
export function optionsCors(config: Pick<ConfigService, 'get'>) {
  return {
    origin: allowedOrigins(config),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 600,
  };
}

/**
 * Requisições sem `Origin` (curl, chamadas servidor-a-servidor) passam; as de navegador
 * precisam vir de uma origem permitida. Usado nas rotas autenticadas por cookie (CSRF).
 */
export function allowedOrigin(origin: string | undefined, allowed: string[]): boolean {
  if (!origin) return true;
  return allowed.includes(origin.replace(/\/+$/, ''));
}
