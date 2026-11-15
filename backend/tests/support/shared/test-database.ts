import { randomBytes } from 'node:crypto';
import { DataSource } from 'typeorm';

process.env.DATA_ENCRYPTION_KEY ??= 'a'.repeat(64);

type Newable = new (...args: never[]) => unknown;

/**
 * O que o TypeORM ainda mudaria no banco para ele ficar igual às entidades, depois das migrations.
 * Vazio = as migrations criam exatamente o schema que as entidades descrevem.
 */
export async function pendingSchemaChanges(dataSource: DataSource): Promise<string[]> {
  const sql = await dataSource.driver.createSchemaBuilder().log();
  return sql.upQueries.map((q) => q.query);
}

export interface TestDatabase {
  dataSource: DataSource;
  /** Esvazia todas as tabelas do schema (entre testes). */
  truncate(): Promise<void>;
  /** Fecha a conexão e remove o banco temporário. */
  destroy(): Promise<void>;
}

const connection = {
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
};

/**
 * Cria um banco Postgres descartável, o schema do serviço e aplica as
 * migrations de produção (assim os repositórios são testados contra o mesmo
 * DDL que roda em produção). Requer um Postgres acessível (DB_HOST/DB_PORT/
 * DB_USERNAME/DB_PASSWORD; padrão localhost:5432 postgres/postgres).
 */
export async function createTestDatabase(options: {
  schema: string;
  entities: Newable[];
  migrations: Newable[];
}): Promise<TestDatabase> {
  const name = `it_${options.schema}_${randomBytes(4).toString('hex')}`;
  const admin = new DataSource({ type: 'postgres', ...connection, database: 'postgres' });
  await admin.initialize();
  await admin.query(`CREATE DATABASE "${name}"`);
  await admin.destroy();

  const bootstrap = new DataSource({ type: 'postgres', ...connection, database: name });
  await bootstrap.initialize();
  await bootstrap.query(`CREATE SCHEMA IF NOT EXISTS "${options.schema}"`);
  await bootstrap.destroy();

  const dataSource = new DataSource({
    type: 'postgres',
    ...connection,
    database: name,
    schema: options.schema,
    entities: options.entities as never[],
    migrations: options.migrations as never[],
    migrationsRun: false,
    synchronize: false,
    uuidExtension: 'pgcrypto',
  });
  await dataSource.initialize();
  await dataSource.runMigrations();

  return {
    dataSource,
    async truncate() {
      const tables = dataSource.entityMetadatas
        .map((m) => `"${options.schema}"."${m.tableName}"`)
        .join(', ');
      await dataSource.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
    },
    async destroy() {
      await dataSource.destroy();
      const cleaner = new DataSource({ type: 'postgres', ...connection, database: 'postgres' });
      await cleaner.initialize();
      await cleaner.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await cleaner.destroy();
    },
  };
}
