export interface ProxyRoute {
  /** Prefixo de path montado no gateway (repassado sem rewrite ao destino). */
  prefix: string;
  /** Nome da variável de ambiente com a URL base do serviço de destino. */
  targetEnvVar: string;
}

/**
 * Tabela de roteamento do gateway. Cada prefixo bate exatamente com o
 * @Controller() do serviço de destino, então não há pathRewrite - o
 * caminho chega ao serviço de destino do jeito que o frontend mandou.
 */
export const PROXY_ROUTES: ProxyRoute[] = [
  { prefix: '/auth', targetEnvVar: 'AUTH_SERVICE_URL' },
  { prefix: '/donors', targetEnvVar: 'ELIGIBILITY_SERVICE_URL' },
  { prefix: '/eligibility', targetEnvVar: 'ELIGIBILITY_SERVICE_URL' },
  { prefix: '/collection-units', targetEnvVar: 'SCHEDULING_SERVICE_URL' },
  { prefix: '/campaigns', targetEnvVar: 'SCHEDULING_SERVICE_URL' },
  { prefix: '/appointments', targetEnvVar: 'SCHEDULING_SERVICE_URL' },
  { prefix: '/outbox', targetEnvVar: 'SCHEDULING_SERVICE_URL' },
  { prefix: '/notifications', targetEnvVar: 'NOTIFICATION_SERVICE_URL' },
];
