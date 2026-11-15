import { HttpModule } from '@nestjs/axios';
import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { RedisHealthIndicator } from '../infrastructure/observability';
import {
  DATABASE_HEALTH_CHECK,
  HEALTH_OPTIONS,
  HealthController,
  HealthOptions,
  REDIS_HEALTH_CHECK,
} from '../presentation/health';

/** Composição do GET /health: liga o controller (presentation) aos indicadores do Redis e do Postgres (infrastructure). */
@Module({})
export class HealthModule {
  static register(options: HealthOptions): DynamicModule {
    return {
      module: HealthModule,
      imports: [TerminusModule, HttpModule, ConfigModule],
      controllers: [HealthController],
      providers: [
        RedisHealthIndicator,
        { provide: REDIS_HEALTH_CHECK, useExisting: RedisHealthIndicator },
        { provide: HEALTH_OPTIONS, useValue: options },
        // Só resolve o indicador do TypeORM (que exige `typeorm` instalado) quando há banco.
        ...(options.database
          ? [{ provide: DATABASE_HEALTH_CHECK, useExisting: TypeOrmHealthIndicator }]
          : []),
      ],
    };
  }
}
