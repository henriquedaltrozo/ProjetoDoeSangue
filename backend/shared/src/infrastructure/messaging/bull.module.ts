import { BullModule } from '@nestjs/bullmq';
import { DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NOTIFICATIONS_QUEUE_NAME } from '../../application/messaging';
import { buildBullConnectionOptions } from './bullmq-config.factory';

/** Conexão Redis do BullMQ (produtores e worker usam a mesma configuração). */
export function registerBullConnection(): DynamicModule {
  return BullModule.forRootAsync({
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: (config: ConfigService) => buildBullConnectionOptions(config),
  });
}

/** Registra a fila `notifications`, compartilhada por produtores e pelo worker. */
export function registerNotificationsQueue(): DynamicModule {
  return BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE_NAME });
}
