import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import Redis from 'ioredis';

/**
 * O `@nestjs/terminus` não tem indicador oficial para Redis (só para
 * Postgres/Mongo/etc, via TypeOrmHealthIndicator e afins) - este é um
 * indicador próprio, com o mesmo padrão defensivo já usado pelo
 * RedisCacheService do scheduling-service (conexão lazy, sem retry
 * indefinido, timeout curto): abre uma conexão dedicada e curta por
 * checagem, faz PING, e sempre desconecta no fim.
 */
@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly config: ConfigService) {
    super();
  }

  async check(key = 'redis'): Promise<HealthIndicatorResult> {
    const client = new Redis({
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      connectTimeout: 2000,
    });

    try {
      await client.connect();
      const pong = await client.ping();
      const isHealthy = pong === 'PONG';
      const result = this.getStatus(key, isHealthy);
      if (!isHealthy) {
        throw new HealthCheckError('Redis não respondeu PING corretamente', result);
      }
      return result;
    } catch (err) {
      if (err instanceof HealthCheckError) {
        throw err;
      }
      const result = this.getStatus(key, false, { message: (err as Error).message });
      throw new HealthCheckError('Redis indisponível', result);
    } finally {
      client.disconnect();
    }
  }
}
