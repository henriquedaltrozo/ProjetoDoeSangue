import { DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildTypeOrmOptions } from './typeorm-config.factory';

/** Conexão TypeORM de um serviço, fixada no schema Postgres que ele possui. */
export function registerDatabase(
  schema: string,
  entities: (new (...args: any[]) => unknown)[],
  migrations: (new (...args: any[]) => unknown)[] = [],
): DynamicModule {
  return TypeOrmModule.forRootAsync({
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: (config: ConfigService) =>
      buildTypeOrmOptions(config, schema, entities, migrations),
  });
}
