import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Novo tipo de e-mail: o link para confirmar o endereço (reenvio e troca de e-mail). */
export class EmailVerificationType1763000000000 implements MigrationInterface {
  name = 'EmailVerificationType1763000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "notification"."sent_notifications_type_enum" ADD VALUE IF NOT EXISTS 'email-verification'`,
    );
  }

  /** O Postgres não remove valores de um enum: apaga os envios desse tipo e recria o tipo. */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "notification"."sent_notifications" WHERE "type"::text = 'email-verification'`,
    );
    await queryRunner.query(
      'ALTER TYPE "notification"."sent_notifications_type_enum" RENAME TO "sent_notifications_type_enum_old"',
    );
    await queryRunner.query(
      `CREATE TYPE "notification"."sent_notifications_type_enum" AS ENUM('reminder-24h', 'attendance-confirmation', 'urgent-campaign', 'interval-completed', 'reset-password', 'password-changed', 'email-changed', 'appointment-booked', 'appointment-canceled', 'eligible-again', 'welcome', 'no-show')`,
    );
    await queryRunner.query(
      'ALTER TABLE "notification"."sent_notifications" ALTER COLUMN "type" TYPE "notification"."sent_notifications_type_enum" USING "type"::text::"notification"."sent_notifications_type_enum"',
    );
    await queryRunner.query('DROP TYPE "notification"."sent_notifications_type_enum_old"');
  }
}
