import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * Monta as opcoes de conexao TypeORM para um servico: o banco Postgres
 * dele (um banco por microsservico - ver docs/01 e docs/06) e o schema
 * dentro desse banco.
 *
 * O schema vem sempre das migrations versionadas do serviço
 * (`services/<serviço>/src/infrastructure/persistence/migrations`), que rodam sozinhas ao subir
 * (`migrationsRun`), em qualquer ambiente: assim o banco de desenvolvimento é igual ao de produção, e
 * uma entidade alterada sem migration aparece logo (os testes de integração também comparam as
 * migrations com as entidades). `DB_SYNCHRONIZE=true` liga o `synchronize` do TypeORM no lugar das
 * migrations, só para experimentar uma mudança de entidade localmente.
 *
 * O schema em si (CREATE SCHEMA) não é criado pelo TypeORM automaticamente
 * - fica a cargo do script de inicialização do Postgres no Docker Compose
 * (infra/postgres/init-databases.sh), que roda antes de qualquer serviço subir.
 *
 * `uuidExtension: 'pgcrypto'` faz o TypeORM gerar as colunas uuid com
 * `DEFAULT gen_random_uuid()` em vez de `uuid_generate_v4()` - a primeira é
 * nativa do Postgres 13+ (sem precisar instalar a extensão uuid-ossp).
 */
export function buildTypeOrmOptions(
  config: ConfigService,
  schema: string,
  entities: (new (...args: any[]) => unknown)[],
  migrations: (new (...args: any[]) => unknown)[] = [],
): TypeOrmModuleOptions {
  const nodeEnv = config.get<string>('NODE_ENV', 'development');
  const synchronize = config.get<string>('DB_SYNCHRONIZE') === 'true';
  // Cada serviço tem o seu banco: `<SCHEMA>_DB_*` (ex.: AUTH_DB_DATABASE) tem
  // prioridade sobre o `DB_*` genérico, o que permite rodar vários serviços
  // no mesmo processo/ambiente (testes, desenvolvimento local) cada um no
  // seu banco. Nos containers, cada serviço recebe só o `DB_*` do seu banco.
  const prefix = schema.toUpperCase();
  const db = <T extends string | number>(key: string, fallback: T): T =>
    config.get<T>(`${prefix}_${key}`) ?? config.get<T>(key, fallback);
  return {
    type: 'postgres',
    host: db('DB_HOST', 'localhost'),
    port: Number(db('DB_PORT', 5432)),
    username: db('DB_USERNAME', 'postgres'),
    password: db('DB_PASSWORD', 'postgres'),
    database: db('DB_DATABASE', 'doesangue'),
    schema,
    entities,
    migrations,
    migrationsRun: !synchronize,
    synchronize,
    logging: nodeEnv === 'development',
    uuidExtension: 'pgcrypto',
  };
}
