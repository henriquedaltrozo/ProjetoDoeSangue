import {
  cpfIndex,
  decryptValue,
  encryptValue,
  nameWordIndexes,
} from '@shared/infrastructure/persistence';
import type { MigrationInterface, QueryRunner } from 'typeorm';

const DONORS = '"eligibility"."donors"';

interface DonorRow {
  id: string;
  completeName: string;
  cpf: string;
  birthDate: string;
  phone: string | null;
  email: string;
}

/**
 * Cifra os dados identificantes do doador em repouso (AES-256-GCM): nome, CPF, data de nascimento,
 * telefone e e-mail. Como a cifra usa IV aleatório e não permite comparar valores, a unicidade e a
 * busca exata do CPF passam a usar um índice cego (`cpfIndex`, HMAC com subchave) e a busca por nome
 * usa os índices cegos das palavras (`nameIndexes`, com índice GIN). Os dados existentes são lidos
 * em claro e regravados cifrados; rodar de novo não repete o trabalho (valores `gcm:` são pulados).
 * Precisa de DATA_ENCRYPTION_KEY, como o próprio serviço.
 */
export class EncryptDonorIdentity1763100000000 implements MigrationInterface {
  name = 'EncryptDonorIdentity1763100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${DONORS} ADD COLUMN IF NOT EXISTS "cpfIndex" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE ${DONORS} ADD COLUMN IF NOT EXISTS "nameIndexes" text[] NOT NULL DEFAULT '{}'`,
    );
    await this.dropCpfUniqueness(queryRunner);
    await queryRunner.query(
      `ALTER TABLE ${DONORS}
         ALTER COLUMN "completeName" TYPE text,
         ALTER COLUMN "cpf" TYPE text,
         ALTER COLUMN "birthDate" TYPE text USING to_char("birthDate", 'YYYY-MM-DD'),
         ALTER COLUMN "phone" TYPE text,
         ALTER COLUMN "email" TYPE text`,
    );

    const rows: DonorRow[] = await queryRunner.query(
      `SELECT id, "completeName", cpf, "birthDate", phone, email FROM ${DONORS}`,
    );
    for (const row of rows) {
      if (row.cpf.startsWith('gcm:')) continue;
      await queryRunner.query(
        `UPDATE ${DONORS}
            SET "completeName" = $1, cpf = $2, "birthDate" = $3, phone = $4, email = $5,
                "cpfIndex" = $6, "nameIndexes" = $7
          WHERE id = $8`,
        [
          encryptValue(row.completeName),
          encryptValue(row.cpf),
          encryptValue(row.birthDate),
          row.phone === null ? null : encryptValue(row.phone),
          encryptValue(row.email),
          cpfIndex(row.cpf),
          nameWordIndexes(row.completeName),
          row.id,
        ],
      );
    }

    await queryRunner.query(`ALTER TABLE ${DONORS} ALTER COLUMN "cpfIndex" SET NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE ${DONORS} ADD CONSTRAINT "UQ_donors_cpf_index" UNIQUE ("cpfIndex")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_donors_name_indexes" ON ${DONORS} USING GIN ("nameIndexes")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "eligibility"."IDX_donors_name_indexes"');
    await queryRunner.query(`ALTER TABLE ${DONORS} DROP CONSTRAINT "UQ_donors_cpf_index"`);

    const rows: DonorRow[] = await queryRunner.query(
      `SELECT id, "completeName", cpf, "birthDate", phone, email FROM ${DONORS}`,
    );
    for (const row of rows) {
      if (!row.cpf.startsWith('gcm:')) continue;
      await queryRunner.query(
        `UPDATE ${DONORS}
            SET "completeName" = $1, cpf = $2, "birthDate" = $3, phone = $4, email = $5
          WHERE id = $6`,
        [
          decryptValue(row.completeName),
          decryptValue(row.cpf),
          decryptValue(row.birthDate),
          row.phone === null ? null : decryptValue(row.phone),
          decryptValue(row.email),
          row.id,
        ],
      );
    }

    await queryRunner.query(
      `ALTER TABLE ${DONORS}
         ALTER COLUMN "completeName" TYPE character varying(150),
         ALTER COLUMN "cpf" TYPE character varying(11),
         ALTER COLUMN "birthDate" TYPE date USING "birthDate"::date,
         ALTER COLUMN "phone" TYPE character varying(20),
         ALTER COLUMN "email" TYPE character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE ${DONORS} DROP COLUMN "nameIndexes", DROP COLUMN "cpfIndex"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_97266aaad343e6ba70c0d82919" ON ${DONORS} ("cpf")`,
    );
  }

  /** A unicidade do CPF em claro (restrição ou índice, conforme a migration que a criou) sai. */
  private async dropCpfUniqueness(queryRunner: QueryRunner): Promise<void> {
    const constraints: { conname: string }[] = await queryRunner.query(
      `SELECT c.conname FROM pg_constraint c
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.conrelid = 'eligibility.donors'::regclass AND c.contype = 'u' AND a.attname = 'cpf'`,
    );
    for (const { conname } of constraints) {
      await queryRunner.query(`ALTER TABLE ${DONORS} DROP CONSTRAINT "${conname}"`);
    }
    const indexes: { relname: string }[] = await queryRunner.query(
      `SELECT i.relname FROM pg_index x
         JOIN pg_class i ON i.oid = x.indexrelid
         JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ANY (x.indkey)
        WHERE x.indrelid = 'eligibility.donors'::regclass AND a.attname = 'cpf'`,
    );
    for (const { relname } of indexes) {
      await queryRunner.query(`DROP INDEX "eligibility"."${relname}"`);
    }
  }
}
