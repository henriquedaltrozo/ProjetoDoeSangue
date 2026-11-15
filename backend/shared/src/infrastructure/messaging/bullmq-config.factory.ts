import { ConfigService } from '@nestjs/config';

/**
 * Opções de conexão Redis para @nestjs/bullmq (usado tanto pelos produtores
 * de job - scheduling-service - quanto pelo worker consumidor -
 * notification-service).
 */
export function buildBullConnectionOptions(config: ConfigService) {
  return {
    connection: {
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: config.get<number>('REDIS_PORT', 6379),
    },
  };
}
