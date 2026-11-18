import {
  decryptValue,
  emailIndex,
  encryptValue,
  isSealed,
  openJson,
  sealJson,
} from '@shared/infrastructure/persistence';
import type { MigrationInterface, QueryRunner } from 'typeorm';

const USERS = '"auth"."users"';

interface UserRow {
  id: string;
  email: string;
  name: string;
  pendingEmail: string | null;
}

/**
 * Cifra o e-mail, o nome e o e-mail pendente do usuário em repouso (AES-256-GCM) e o corpo dos avisos
 * da conta ainda não enviados (nome, e-mail e links com token). O login e a unicidade do e-mail passam
 * a usar um índice cego (`emailIndex`, HMAC do e-mail normalizado). Os dados existentes são regravados
 * cifrados; rodar de novo não repete o trabalho. Precisa de DATA_ENCRYPTION_KEY, como o serviço.
 */
export class EncryptUserIdentity1763100000000 implements MigrationInterface {
  name = 'EncryptUserIdentity1763100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${USERS} ADD COLUMN IF NOT EXISTS "emailIndex" character varying(64)`,
    );
    await this.dropEmailUniqueness(queryRunner);
    await queryRunner.query(
      `ALTER TABLE ${USERS}
         ALTER COLUMN "email" TYPE text,
         ALTER COLUMN "name" TYPE text,
         ALTER COLUMN "pendingEmail" TYPE text`,
    );

    const rows: UserRow[] = await queryRunner.query(
      `SELECT id, email, name, "pendingEmail" FROM ${USERS}`,
    );
    for (const row of rows) {
      if (row.email.startsWith('gcm:')) continue;
      await queryRunner.query(
        `UPDATE ${USERS}
            SET email = $1, name = $2, "pendingEmail" = $3, "emailIndex" = $4
          WHERE id = $5`,
        [
          encryptValue(row.email),
          encryptValue(row.name),
          row.pendingEmail === null ? null : encryptValue(row.pendingEmail),
          emailIndex(row.email),
          row.id,
        ],
      );
    }

    await queryRunner.query(`ALTER TABLE ${USERS} ALTER COLUMN "emailIndex" SET NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE ${USERS} ADD CONSTRAINT "UQ_users_email_index" UNIQUE ("emailIndex")`,
    );

    const notices: { id: string; payload: unknown }[] = await queryRunner.query(
      'SELECT id, payload FROM "auth"."account_notices"',
    );
    for (const notice of notices) {
      if (isSealed(notice.payload)) continue;
      await queryRunner.query('UPDATE "auth"."account_notices" SET payload = $1 WHERE id = $2', [
        JSON.stringify(sealJson(notice.payload)),
        notice.id,
      ]);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE ${USERS} DROP CONSTRAINT "UQ_users_email_index"`);

    const notices: { id: string; payload: unknown }[] = await queryRunner.query(
      'SELECT id, payload FROM "auth"."account_notices"',
    );
    for (const notice of notices) {
      if (!isSealed(notice.payload)) continue;
      await queryRunner.query('UPDATE "auth"."account_notices" SET payload = $1 WHERE id = $2', [
        JSON.stringify(openJson(notice.payload)),
        notice.id,
      ]);
    }

    const rows: UserRow[] = await queryRunner.query(
      `SELECT id, email, name, "pendingEmail" FROM ${USERS}`,
    );
    for (const row of rows) {
      if (!row.email.startsWith('gcm:')) continue;
      await queryRunner.query(
        `UPDATE ${USERS} SET email = $1, name = $2, "pendingEmail" = $3 WHERE id = $4`,
        [
          decryptValue(row.email),
          decryptValue(row.name),
          row.pendingEmail === null ? null : decryptValue(row.pendingEmail),
          row.id,
        ],
      );
    }
    await queryRunner.query(
      `ALTER TABLE ${USERS}
         ALTER COLUMN "email" TYPE character varying(255),
         ALTER COLUMN "name" TYPE character varying(150),
         ALTER COLUMN "pendingEmail" TYPE character varying(255)`,
    );
    await queryRunner.query(`ALTER TABLE ${USERS} DROP COLUMN "emailIndex"`);
    await queryRunner.query(
      `ALTER TABLE ${USERS} ADD CONSTRAINT "UQ_users_email" UNIQUE ("email")`,
    );
  }

  /** A unicidade do e-mail em claro (restrição ou índice, conforme a migration que a criou) sai. */
  private async dropEmailUniqueness(queryRunner: QueryRunner): Promise<void> {
    const constraints: { conname: string }[] = await queryRunner.query(
      `SELECT c.conname FROM pg_constraint c
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.conrelid = 'auth.users'::regclass AND c.contype = 'u' AND a.attname = 'email'`,
    );
    for (const { conname } of constraints) {
      await queryRunner.query(`ALTER TABLE ${USERS} DROP CONSTRAINT "${conname}"`);
    }
    const indexes: { relname: string }[] = await queryRunner.query(
      `SELECT i.relname FROM pg_index x
         JOIN pg_class i ON i.oid = x.indexrelid
         JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ANY (x.indkey)
        WHERE x.indrelid = 'auth.users'::regclass AND a.attname = 'email'`,
    );
    for (const { relname } of indexes) {
      await queryRunner.query(`DROP INDEX "auth"."${relname}"`);
    }
  }
}
