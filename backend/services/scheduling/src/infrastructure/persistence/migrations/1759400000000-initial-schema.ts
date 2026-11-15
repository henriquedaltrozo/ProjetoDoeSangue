import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Schema inicial do scheduling-service, gerado a partir das entidades ORM. O schema Postgres
 * (`CREATE SCHEMA`) é criado pelo script de inicialização do banco (infra/postgres) antes do serviço subir.
 */
export class InitialSchema1759400000000 implements MigrationInterface {
  name = 'InitialSchema1759400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE "scheduling"."collection_units" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(150) NOT NULL, "address" character varying(255) NOT NULL, "city" character varying(100) NOT NULL, "uf" character(2) NOT NULL, "phone" character varying(20) NOT NULL, "simultaneousCapacity" integer NOT NULL, "operatingHours" jsonb, "active" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c85599b02c15c2d6e22c4aedc70" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      "CREATE TYPE \"scheduling\".\"campaigns_type_enum\" AS ENUM('REGULAR', 'URGENT', 'SPECIFIC_BLOOD_TYPE')",
    );
    await queryRunner.query(
      "CREATE TYPE \"scheduling\".\"campaigns_targetbloodtype_enum\" AS ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')",
    );
    await queryRunner.query(
      'CREATE TABLE "scheduling"."campaigns" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "title" character varying(150) NOT NULL, "description" text NOT NULL, "type" "scheduling"."campaigns_type_enum" NOT NULL, "targetBloodType" "scheduling"."campaigns_targetbloodtype_enum", "collectionUnitId" uuid, "startDate" date NOT NULL, "endDate" date NOT NULL, "active" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_831e3fcd4fc45b4e4c3f57a9ee4" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      "CREATE TYPE \"scheduling\".\"appointments_status_enum\" AS ENUM('SCHEDULED', 'ELIGIBILITY_CONFIRMED', 'ELIGIBILITY_DENIED', 'CONFIRMED', 'CHECKIN_PERFORMED', 'COMPLETED', 'CANCELED', 'NO_SHOW')",
    );
    await queryRunner.query(
      'CREATE TABLE "scheduling"."appointments" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "donorId" uuid NOT NULL, "collectionUnitId" uuid NOT NULL, "campaignId" uuid, "dateTime" TIMESTAMP WITH TIME ZONE NOT NULL, "status" "scheduling"."appointments_status_enum" NOT NULL DEFAULT \'SCHEDULED\', "assessmentEligibilityId" uuid, "cancellationReason" text, "confirmedAt" TIMESTAMP WITH TIME ZONE, "checkinAt" TIMESTAMP WITH TIME ZONE, "completedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_4a437a9a27e948726b8bb3e36ad" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_ac638c18a21451689b07497941" ON "scheduling"."appointments" ("donorId") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_2fb163567e1e0b500de2880590" ON "scheduling"."appointments" ("collectionUnitId", "dateTime") ',
    );
    await queryRunner.query(
      'CREATE TABLE "scheduling"."outbox_events" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "type" character varying(60) NOT NULL, "payload" jsonb NOT NULL, "status" character varying(20) NOT NULL DEFAULT \'PENDING\', "attempts" integer NOT NULL DEFAULT \'0\', "reprocessings" integer NOT NULL DEFAULT \'0\', "nextAttemptAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "lastError" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "processedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6689a16c00d09b8089f6237f1d2" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_d2869b821d7b201618c9858ab6" ON "scheduling"."outbox_events" ("status", "nextAttemptAt") ',
    );
    await queryRunner.query(
      'ALTER TABLE "scheduling"."campaigns" ADD CONSTRAINT "FK_3dfdf0a56cdaea008f35d19c2f8" FOREIGN KEY ("collectionUnitId") REFERENCES "scheduling"."collection_units"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "scheduling"."appointments" ADD CONSTRAINT "FK_7d8f191eaf8547a76a454cf4a4e" FOREIGN KEY ("collectionUnitId") REFERENCES "scheduling"."collection_units"("id") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "scheduling"."appointments" ADD CONSTRAINT "FK_4cb3b1863dd590c07490e648855" FOREIGN KEY ("campaignId") REFERENCES "scheduling"."campaigns"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "scheduling"."appointments" DROP CONSTRAINT "FK_4cb3b1863dd590c07490e648855"',
    );
    await queryRunner.query(
      'ALTER TABLE "scheduling"."appointments" DROP CONSTRAINT "FK_7d8f191eaf8547a76a454cf4a4e"',
    );
    await queryRunner.query(
      'ALTER TABLE "scheduling"."campaigns" DROP CONSTRAINT "FK_3dfdf0a56cdaea008f35d19c2f8"',
    );
    await queryRunner.query('DROP INDEX "scheduling"."IDX_d2869b821d7b201618c9858ab6"');
    await queryRunner.query('DROP TABLE "scheduling"."outbox_events"');
    await queryRunner.query('DROP INDEX "scheduling"."IDX_2fb163567e1e0b500de2880590"');
    await queryRunner.query('DROP INDEX "scheduling"."IDX_ac638c18a21451689b07497941"');
    await queryRunner.query('DROP TABLE "scheduling"."appointments"');
    await queryRunner.query('DROP TYPE "scheduling"."appointments_status_enum"');
    await queryRunner.query('DROP TABLE "scheduling"."campaigns"');
    await queryRunner.query('DROP TYPE "scheduling"."campaigns_targetbloodtype_enum"');
    await queryRunner.query('DROP TYPE "scheduling"."campaigns_type_enum"');
    await queryRunner.query('DROP TABLE "scheduling"."collection_units"');
  }
}
