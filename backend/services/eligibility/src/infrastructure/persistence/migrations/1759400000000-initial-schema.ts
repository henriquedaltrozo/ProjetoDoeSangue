import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Schema inicial do eligibility-service, gerado a partir das entidades ORM. O schema Postgres
 * (`CREATE SCHEMA`) é criado pelo script de inicialização do banco (infra/postgres) antes do serviço subir.
 */
export class InitialSchema1759400000000 implements MigrationInterface {
  name = 'InitialSchema1759400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TYPE "eligibility"."audit_accesses_userrole_enum" AS ENUM(\'donor\', \'admin\')',
    );
    await queryRunner.query(
      "CREATE TYPE \"eligibility\".\"audit_accesses_action_enum\" AS ENUM('VIEW', 'UPDATE', 'EXPORT', 'ANONYMIZATION')",
    );
    await queryRunner.query(
      'CREATE TABLE "eligibility"."audit_accesses" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "donorId" uuid NOT NULL, "userId" uuid, "userRole" "eligibility"."audit_accesses_userrole_enum" NOT NULL, "action" "eligibility"."audit_accesses_action_enum" NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d8fd12115b1d9242dd31e63171a" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_a640e18de30ab7a0aa9ef06b31" ON "eligibility"."audit_accesses" ("donorId") ',
    );
    await queryRunner.query('CREATE TYPE "eligibility"."donors_sex_enum" AS ENUM(\'M\', \'F\')');
    await queryRunner.query(
      'CREATE TABLE "eligibility"."donors" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "completeName" character varying(150) NOT NULL, "cpf" character varying(11) NOT NULL, "birthDate" date NOT NULL, "sex" "eligibility"."donors_sex_enum" NOT NULL, "phone" character varying(20) NOT NULL, "email" character varying(255) NOT NULL, "weightKg" character varying(255) NOT NULL, "heightCm" character varying(255), "bloodType" character varying(255), "lastDonationAt" date, "permanentUnfit" boolean NOT NULL DEFAULT false, "permanentUnfitnessReason" text, "active" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_293976165d17c888acc7e254fa0" UNIQUE ("userId"), CONSTRAINT "UQ_97266aaad343e6ba70c0d82919e" UNIQUE ("cpf"), CONSTRAINT "PK_7fafae759bcc8cc1dfa09c3fbcf" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_293976165d17c888acc7e254fa" ON "eligibility"."donors" ("userId") ',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_97266aaad343e6ba70c0d82919" ON "eligibility"."donors" ("cpf") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_b1f955a4e4fdbad367f9a27a23" ON "eligibility"."donors" ("lastDonationAt") ',
    );
    await queryRunner.query(
      "CREATE TYPE \"eligibility\".\"eligibility_assessments_result_enum\" AS ENUM('ELIGIBLE', 'TEMPORARY_UNFIT', 'PERMANENT_UNFIT')",
    );
    await queryRunner.query(
      'CREATE TYPE "eligibility"."eligibility_assessments_origin_enum" AS ENUM(\'DONOR_QUERY\', \'APPOINTMENT_VALIDATION\')',
    );
    await queryRunner.query(
      'CREATE TABLE "eligibility"."eligibility_assessments" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "donorId" uuid NOT NULL, "appointmentId" uuid, "result" "eligibility"."eligibility_assessments_result_enum" NOT NULL, "reasons" jsonb NOT NULL DEFAULT \'[]\', "nextEligibilityDate" date, "origin" "eligibility"."eligibility_assessments_origin_enum" NOT NULL, "assessedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_4ae975dcba1133e53d27f1ed025" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_3e04bd822b5aea24c855276aea" ON "eligibility"."eligibility_assessments" ("donorId") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_0e61ea4e712721d9412369c59a" ON "eligibility"."eligibility_assessments" ("appointmentId") ',
    );
    await queryRunner.query(
      "CREATE TYPE \"eligibility\".\"temporary_unfitness_category_enum\" AS ENUM('CLINIC', 'BEHAVIORAL', 'LABORATORY', 'OTHER')",
    );
    await queryRunner.query(
      'CREATE TABLE "eligibility"."temporary_unfitness" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "donorId" uuid NOT NULL, "reason" text NOT NULL, "category" "eligibility"."temporary_unfitness_category_enum" NOT NULL, "startDate" date NOT NULL, "expectedEndDate" date, "actualEndDate" date, "registeredBy" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_12a48ca88f5d6bbf36c87e57bf3" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_9352a06ea2c83c60b239f4101c" ON "eligibility"."temporary_unfitness" ("donorId") ',
    );
    await queryRunner.query(
      'ALTER TABLE "eligibility"."eligibility_assessments" ADD CONSTRAINT "FK_3e04bd822b5aea24c855276aeaa" FOREIGN KEY ("donorId") REFERENCES "eligibility"."donors"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "eligibility"."temporary_unfitness" ADD CONSTRAINT "FK_9352a06ea2c83c60b239f4101c6" FOREIGN KEY ("donorId") REFERENCES "eligibility"."donors"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "eligibility"."temporary_unfitness" DROP CONSTRAINT "FK_9352a06ea2c83c60b239f4101c6"',
    );
    await queryRunner.query(
      'ALTER TABLE "eligibility"."eligibility_assessments" DROP CONSTRAINT "FK_3e04bd822b5aea24c855276aeaa"',
    );
    await queryRunner.query('DROP INDEX "eligibility"."IDX_9352a06ea2c83c60b239f4101c"');
    await queryRunner.query('DROP TABLE "eligibility"."temporary_unfitness"');
    await queryRunner.query('DROP TYPE "eligibility"."temporary_unfitness_category_enum"');
    await queryRunner.query('DROP INDEX "eligibility"."IDX_0e61ea4e712721d9412369c59a"');
    await queryRunner.query('DROP INDEX "eligibility"."IDX_3e04bd822b5aea24c855276aea"');
    await queryRunner.query('DROP TABLE "eligibility"."eligibility_assessments"');
    await queryRunner.query('DROP TYPE "eligibility"."eligibility_assessments_origin_enum"');
    await queryRunner.query('DROP TYPE "eligibility"."eligibility_assessments_result_enum"');
    await queryRunner.query('DROP INDEX "eligibility"."IDX_b1f955a4e4fdbad367f9a27a23"');
    await queryRunner.query('DROP INDEX "eligibility"."IDX_97266aaad343e6ba70c0d82919"');
    await queryRunner.query('DROP INDEX "eligibility"."IDX_293976165d17c888acc7e254fa"');
    await queryRunner.query('DROP TABLE "eligibility"."donors"');
    await queryRunner.query('DROP TYPE "eligibility"."donors_sex_enum"');
    await queryRunner.query('DROP INDEX "eligibility"."IDX_a640e18de30ab7a0aa9ef06b31"');
    await queryRunner.query('DROP TABLE "eligibility"."audit_accesses"');
    await queryRunner.query('DROP TYPE "eligibility"."audit_accesses_action_enum"');
    await queryRunner.query('DROP TYPE "eligibility"."audit_accesses_userrole_enum"');
  }
}
