import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Schema inicial do notification-service, gerado a partir das entidades ORM. O schema Postgres
 * (`CREATE SCHEMA`) é criado pelo script de inicialização do banco (infra/postgres) antes do serviço subir.
 */
export class InitialSchema1759400000000 implements MigrationInterface {
  name = 'InitialSchema1759400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "CREATE TYPE \"notification\".\"sent_notifications_type_enum\" AS ENUM('reminder-24h', 'attendance-confirmation', 'urgent-campaign', 'interval-completed', 'reset-password')",
    );
    await queryRunner.query(
      'CREATE TYPE "notification"."sent_notifications_channel_enum" AS ENUM(\'EMAIL\', \'SMS\')',
    );
    await queryRunner.query(
      'CREATE TYPE "notification"."sent_notifications_status_enum" AS ENUM(\'SENT\', \'FAILURE\')',
    );
    await queryRunner.query(
      'CREATE TABLE "notification"."sent_notifications" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "donorId" uuid, "userId" uuid, "type" "notification"."sent_notifications_type_enum" NOT NULL, "channel" "notification"."sent_notifications_channel_enum" NOT NULL DEFAULT \'EMAIL\', "recipient" character varying(255) NOT NULL, "subject" character varying(255) NOT NULL, "message" text NOT NULL, "status" "notification"."sent_notifications_status_enum" NOT NULL, "error" text, "jobId" character varying(100), "sentAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d51e53c462c7e75c4d96dbdf792" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_2a9e14efec0cfac50ba07ef954" ON "notification"."sent_notifications" ("donorId") ',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "notification"."IDX_2a9e14efec0cfac50ba07ef954"');
    await queryRunner.query('DROP TABLE "notification"."sent_notifications"');
    await queryRunner.query('DROP TYPE "notification"."sent_notifications_status_enum"');
    await queryRunner.query('DROP TYPE "notification"."sent_notifications_channel_enum"');
    await queryRunner.query('DROP TYPE "notification"."sent_notifications_type_enum"');
  }
}
