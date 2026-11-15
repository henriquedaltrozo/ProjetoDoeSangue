import type { HealthIndicatorResult } from '@nestjs/terminus';

export const HEALTH_OPTIONS = Symbol('HEALTH_OPTIONS');

/** Porta da checagem do Redis; o adaptador concreto é ligado em shared/src/bootstrap/health.module.ts. */
export const REDIS_HEALTH_CHECK = Symbol('REDIS_HEALTH_CHECK');

export interface RedisHealthCheck {
  check(key?: string): Promise<HealthIndicatorResult>;
}

/**
 * Porta da checagem do Postgres. Só é registrada quando o serviço declara `database: true`:
 * o indicador do TypeORM exige `typeorm` instalado, e serviços sem banco (gateway) não o têm.
 */
export const DATABASE_HEALTH_CHECK = Symbol('DATABASE_HEALTH_CHECK');

export interface DatabaseHealthCheck {
  pingCheck(key: string): Promise<HealthIndicatorResult>;
}

export interface HealthOptions {
  /** Checa o Postgres (conexão TypeORM do serviço). */
  database?: boolean;
  /** Checa o Redis. */
  redis?: boolean;
  /** Checa o /health de outros serviços (nome exibido + variável de ambiente com a URL base). */
  services?: { name: string; urlEnvVar: string }[];
}
