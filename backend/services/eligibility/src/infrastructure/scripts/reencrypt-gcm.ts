/**
 * Migração única: regrava no formato AES-256-GCM os valores cifrados que ainda estão no formato
 * antigo (AES-256-CBC). Idempotente: valores já em GCM são ignorados.
 *
 *   pnpm run build && pnpm run reencrypt        (usa DATA_ENCRYPTION_KEY e ELIGIBILITY_DB_ ou DB_ (host, porta, usuário, senha, banco))
 *
 * Importante para `donors.bloodType` (cifra determinística, usada em buscas por igualdade):
 * enquanto houver linhas no formato antigo, a busca por tipo sanguíneo não as encontra.
 */
import { encryptValue, decryptValue, legacyValue } from '@shared/infrastructure/persistence';
import { Client } from 'pg';

interface ColumnEncrypted {
  table: string;
  column: string;
  deterministic: boolean;
}

const COLUMNS: ColumnEncrypted[] = [
  { table: 'donors', column: 'weightKg', deterministic: false },
  { table: 'donors', column: 'bloodType', deterministic: true },
  { table: 'donors', column: 'permanentUnfitnessReason', deterministic: false },
  { table: 'temporary_unfitness', column: 'reason', deterministic: false },
];

const env = (key: string, fallback: string) =>
  process.env[`ELIGIBILITY_${key}`] ?? process.env[key] ?? fallback;

async function main(): Promise<void> {
  const client = new Client({
    host: env('DB_HOST', 'localhost'),
    port: Number(env('DB_PORT', '5432')),
    user: env('DB_USERNAME', 'postgres'),
    password: env('DB_PASSWORD', 'postgres'),
    database: env('DB_DATABASE', 'eligibility_db'),
  });
  await client.connect();
  try {
    await client.query('BEGIN');
    for (const { table, column, deterministic } of COLUMNS) {
      const { rows } = await client.query<{ id: string; value: string }>(
        `SELECT id, "${column}" AS value FROM eligibility."${table}" WHERE "${column}" IS NOT NULL`,
      );
      let migrated = 0;
      for (const { id, value } of rows) {
        if (!legacyValue(value)) continue;
        const draft = encryptValue(decryptValue(value), deterministic);
        await client.query(`UPDATE eligibility."${table}" SET "${column}" = $1 WHERE id = $2`, [
          draft,
          id,
        ]);
        migrated += 1;
      }
      console.log(`${table}.${column}: ${migrated} de ${rows.length} valores migrados`);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
