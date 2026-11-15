import { Controller, Get, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  HealthIndicatorFunction,
  HttpHealthIndicator,
} from '@nestjs/terminus';
import {
  DATABASE_HEALTH_CHECK,
  type DatabaseHealthCheck,
  HEALTH_OPTIONS,
  HealthOptions,
  REDIS_HEALTH_CHECK,
  RedisHealthCheck,
} from './health.options';

/**
 * GET /health compartilhado pelos 5 serviços: só roda as checagens que o
 * serviço declarou em HealthModule.register (Postgres, Redis e/ou o
 * /health de outros serviços). Responde 503 quando alguma falha, o que
 * habilita `condition: service_healthy` no docker-compose.yml.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    @Optional() @Inject(DATABASE_HEALTH_CHECK) private readonly db: DatabaseHealthCheck | null,
    @Inject(REDIS_HEALTH_CHECK) private readonly redis: RedisHealthCheck,
    private readonly http: HttpHealthIndicator,
    private readonly config: ConfigService,
    @Inject(HEALTH_OPTIONS) private readonly options: HealthOptions,
  ) {}

  @Get()
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    const checks: HealthIndicatorFunction[] = [];
    if (this.options.database) {
      const db = this.db;
      if (!db) throw new Error('HealthModule: database=true sem DATABASE_HEALTH_CHECK registrado.');
      checks.push(() => db.pingCheck('database'));
    }
    if (this.options.redis) {
      checks.push(() => this.redis.check('redis'));
    }
    for (const service of this.options.services ?? []) {
      const url = this.config.getOrThrow<string>(service.urlEnvVar);
      checks.push(() => this.http.pingCheck(service.name, `${url}/health`));
    }
    return this.health.check(checks);
  }
}
