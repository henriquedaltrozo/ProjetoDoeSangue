import type { MigrationInterface, QueryRunner } from 'typeorm';

const NEW_TYPES = [
  'password-changed',
  'email-changed',
  'appointment-booked',
  'appointment-canceled',
  'eligible-again',
];

/**
 * Novos tipos de e-mail: avisos de senha e de e-mail alterados, confirmação e cancelamento de
 * agendamento e o aviso de que o doador já pode doar de novo.
 */
export class NewNotificationTypes1762800000000 implements MigrationInterface {
  name = 'NewNotificationTypes1762800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const type of NEW_TYPES) {
      await queryRunner.query(
        `ALTER TYPE "notification"."sent_notifications_type_enum" ADD VALUE IF NOT EXISTS '${type}'`,
      );
    }
  }

  /** O Postgres não remove valores de um enum: apaga os envios desses tipos e recria o tipo. */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "notification"."sent_notifications" WHERE "type"::text IN (${NEW_TYPES.map((t) => `'${t}'`).join(', ')})`,
    );
    await queryRunner.query(
      'ALTER TYPE "notification"."sent_notifications_type_enum" RENAME TO "sent_notifications_type_enum_old"',
    );
    await queryRunner.query(
      `CREATE TYPE "notification"."sent_notifications_type_enum" AS ENUM('reminder-24h', 'attendance-confirmation', 'urgent-campaign', 'interval-completed', 'reset-password')`,
    );
    await queryRunner.query(
      'ALTER TABLE "notification"."sent_notifications" ALTER COLUMN "type" TYPE "notification"."sent_notifications_type_enum" USING "type"::text::"notification"."sent_notifications_type_enum"',
    );
    await queryRunner.query('DROP TYPE "notification"."sent_notifications_type_enum_old"');
  }
}
