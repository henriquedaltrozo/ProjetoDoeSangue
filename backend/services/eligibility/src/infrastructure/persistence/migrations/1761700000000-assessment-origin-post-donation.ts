import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Nova origem de avaliação, POST_DONATION: a reavaliação automática que o scheduling faz depois de
 * uma doação concluída. Antes ela era gravada como DONOR_QUERY, o que deixava o histórico errado.
 */
export class AssessmentOriginPostDonation1761700000000 implements MigrationInterface {
  name = 'AssessmentOriginPostDonation1761700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "eligibility"."eligibility_assessments_origin_enum" ADD VALUE IF NOT EXISTS 'POST_DONATION'`,
    );
  }

  /** O Postgres não remove valores de um enum: recria o tipo sem POST_DONATION (essas avaliações voltam a DONOR_QUERY). */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "eligibility"."eligibility_assessments" SET "origin" = 'DONOR_QUERY' WHERE "origin" = 'POST_DONATION'`,
    );
    await queryRunner.query(
      'ALTER TYPE "eligibility"."eligibility_assessments_origin_enum" RENAME TO "eligibility_assessments_origin_enum_old"',
    );
    await queryRunner.query(
      `CREATE TYPE "eligibility"."eligibility_assessments_origin_enum" AS ENUM('DONOR_QUERY', 'APPOINTMENT_VALIDATION')`,
    );
    await queryRunner.query(
      'ALTER TABLE "eligibility"."eligibility_assessments" ALTER COLUMN "origin" TYPE "eligibility"."eligibility_assessments_origin_enum" USING "origin"::text::"eligibility"."eligibility_assessments_origin_enum"',
    );
    await queryRunner.query('DROP TYPE "eligibility"."eligibility_assessments_origin_enum_old"');
  }
}
