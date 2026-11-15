import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * - Novos tipos de e-mail: boas-vindas e aviso de falta.
 * - Novo status SUPPRESSED: e-mail não enviado porque o endereço está bloqueado.
 * - `suppressed_recipients`: endereços que devolveram e-mail ou marcaram como spam.
 */
export class WelcomeNoShowSuppression1762900000000 implements MigrationInterface {
  name = 'WelcomeNoShowSuppression1762900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const type of ['welcome', 'no-show']) {
      await queryRunner.query(
        `ALTER TYPE "notification"."sent_notifications_type_enum" ADD VALUE IF NOT EXISTS '${type}'`,
      );
    }
    await queryRunner.query(
      `ALTER TYPE "notification"."sent_notifications_status_enum" ADD VALUE IF NOT EXISTS 'SUPPRESSED'`,
    );
    await queryRunner.query(
      'CREATE TABLE "notification"."suppressed_recipients" ("email" character varying(255) NOT NULL, "reason" character varying(60) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_99f12bab6192bb47231d7dc7d45" PRIMARY KEY ("email"))',
    );
  }

  /** O Postgres não remove valores de um enum: apaga os registros com eles e recria os tipos. */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "notification"."suppressed_recipients"');
    await queryRunner.query(
      `DELETE FROM "notification"."sent_notifications" WHERE "type"::text IN ('welcome', 'no-show') OR "status"::text = 'SUPPRESSED'`,
    );
    await queryRunner.query(
      'ALTER TYPE "notification"."sent_notifications_status_enum" RENAME TO "sent_notifications_status_enum_old"',
    );
    await queryRunner.query(
      `CREATE TYPE "notification"."sent_notifications_status_enum" AS ENUM('SENT', 'FAILURE')`,
    );
    await queryRunner.query(
      'ALTER TABLE "notification"."sent_notifications" ALTER COLUMN "status" TYPE "notification"."sent_notifications_status_enum" USING "status"::text::"notification"."sent_notifications_status_enum"',
    );
    await queryRunner.query('DROP TYPE "notification"."sent_notifications_status_enum_old"');
    await queryRunner.query(
      'ALTER TYPE "notification"."sent_notifications_type_enum" RENAME TO "sent_notifications_type_enum_old"',
    );
    await queryRunner.query(
      `CREATE TYPE "notification"."sent_notifications_type_enum" AS ENUM('reminder-24h', 'attendance-confirmation', 'urgent-campaign', 'interval-completed', 'reset-password', 'password-changed', 'email-changed', 'appointment-booked', 'appointment-canceled', 'eligible-again')`,
    );
    await queryRunner.query(
      'ALTER TABLE "notification"."sent_notifications" ALTER COLUMN "type" TYPE "notification"."sent_notifications_type_enum" USING "type"::text::"notification"."sent_notifications_type_enum"',
    );
    await queryRunner.query('DROP TYPE "notification"."sent_notifications_type_enum_old"');
  }
}
