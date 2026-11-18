import { decryptValue, emailIndex, encryptValue } from '@shared/infrastructure/persistence';
import type { MigrationInterface, QueryRunner } from 'typeorm';

const LOG = '"notification"."sent_notifications"';
const SUPPRESSED = '"notification"."suppressed_recipients"';
const OLD_SEND_INDEX = '"notification"."IDX_a8253f377b5fadc9eb5d5cac92"';

interface LogRow {
  id: string;
  recipient: string;
  subject: string;
  message: string;
  error: string | null;
}

/**
 * Cifra os dados pessoais do registro de envios (destinatário, assunto, texto e motivo da falha) e o
 * e-mail da lista de supressão (AES-256-GCM). A consulta "este job já foi enviado a este endereço" e a
 * chave da lista de supressão passam a usar o índice cego do e-mail (HMAC com subchave). Os registros
 * existentes são regravados cifrados; rodar de novo não repete o trabalho. Precisa de
 * DATA_ENCRYPTION_KEY, como o serviço.
 */
export class EncryptNotificationRecipients1763100000000 implements MigrationInterface {
  name = 'EncryptNotificationRecipients1763100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // --- registro de envios
    await queryRunner.query(
      `ALTER TABLE ${LOG} ADD COLUMN IF NOT EXISTS "recipientIndex" character varying(64)`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS ${OLD_SEND_INDEX}`);
    await queryRunner.query(
      `ALTER TABLE ${LOG}
         ALTER COLUMN "recipient" TYPE text,
         ALTER COLUMN "subject" TYPE text`,
    );
    const logs: LogRow[] = await queryRunner.query(
      `SELECT id, recipient, subject, message, error FROM ${LOG}`,
    );
    for (const row of logs) {
      if (row.message.startsWith('gcm:')) continue;
      await queryRunner.query(
        `UPDATE ${LOG}
            SET recipient = $1, "recipientIndex" = $2, subject = $3, message = $4, error = $5
          WHERE id = $6`,
        [
          encryptValue(row.recipient),
          // Registros já apagados guardam o marcador no lugar do endereço: sem índice.
          row.recipient.includes('@') ? emailIndex(row.recipient) : null,
          encryptValue(row.subject),
          encryptValue(row.message),
          row.error === null ? null : encryptValue(row.error),
          row.id,
        ],
      );
    }
    await queryRunner.query(
      `CREATE INDEX "IDX_e20658fc3c4d41f11804040b60" ON ${LOG} ("jobId", "recipientIndex")`,
    );

    // --- lista de supressão (a chave passa a ser o índice cego)
    await queryRunner.query(
      `ALTER TABLE ${SUPPRESSED} ADD COLUMN IF NOT EXISTS "emailIndex" character varying(64)`,
    );
    await queryRunner.query(`ALTER TABLE ${SUPPRESSED} ALTER COLUMN "email" TYPE text`);
    const suppressed: { email: string }[] = await queryRunner.query(
      `SELECT email FROM ${SUPPRESSED} WHERE "emailIndex" IS NULL`,
    );
    for (const row of suppressed) {
      await queryRunner.query(
        `UPDATE ${SUPPRESSED} SET email = $1, "emailIndex" = $2 WHERE email = $3`,
        [encryptValue(row.email), emailIndex(row.email), row.email],
      );
    }
    await this.dropPrimaryKey(queryRunner);
    await queryRunner.query(`ALTER TABLE ${SUPPRESSED} ALTER COLUMN "emailIndex" SET NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE ${SUPPRESSED} ADD CONSTRAINT "PK_suppressed_recipients_email_index" PRIMARY KEY ("emailIndex")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${SUPPRESSED} DROP CONSTRAINT "PK_suppressed_recipients_email_index"`,
    );
    const suppressed: { email: string }[] = await queryRunner.query(
      `SELECT email FROM ${SUPPRESSED}`,
    );
    for (const row of suppressed) {
      if (!row.email.startsWith('gcm:')) continue;
      await queryRunner.query(`UPDATE ${SUPPRESSED} SET email = $1 WHERE email = $2`, [
        decryptValue(row.email),
        row.email,
      ]);
    }
    await queryRunner.query(`ALTER TABLE ${SUPPRESSED} DROP COLUMN "emailIndex"`);
    await queryRunner.query(
      `ALTER TABLE ${SUPPRESSED} ALTER COLUMN "email" TYPE character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE ${SUPPRESSED} ADD CONSTRAINT "PK_suppressed_recipients_email" PRIMARY KEY ("email")`,
    );

    await queryRunner.query('DROP INDEX "notification"."IDX_e20658fc3c4d41f11804040b60"');
    const logs: LogRow[] = await queryRunner.query(
      `SELECT id, recipient, subject, message, error FROM ${LOG}`,
    );
    for (const row of logs) {
      if (!row.message.startsWith('gcm:')) continue;
      await queryRunner.query(
        `UPDATE ${LOG} SET recipient = $1, subject = $2, message = $3, error = $4 WHERE id = $5`,
        [
          decryptValue(row.recipient),
          decryptValue(row.subject),
          decryptValue(row.message),
          row.error === null ? null : decryptValue(row.error),
          row.id,
        ],
      );
    }
    await queryRunner.query(
      `ALTER TABLE ${LOG}
         ALTER COLUMN "recipient" TYPE character varying(255),
         ALTER COLUMN "subject" TYPE character varying(255)`,
    );
    await queryRunner.query(`ALTER TABLE ${LOG} DROP COLUMN "recipientIndex"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_a8253f377b5fadc9eb5d5cac92" ON ${LOG} ("jobId", "recipient")`,
    );
  }

  private async dropPrimaryKey(queryRunner: QueryRunner): Promise<void> {
    const keys: { conname: string }[] = await queryRunner.query(
      `SELECT conname FROM pg_constraint
        WHERE conrelid = 'notification.suppressed_recipients'::regclass AND contype = 'p'`,
    );
    for (const { conname } of keys) {
      await queryRunner.query(`ALTER TABLE ${SUPPRESSED} DROP CONSTRAINT "${conname}"`);
    }
  }
}
