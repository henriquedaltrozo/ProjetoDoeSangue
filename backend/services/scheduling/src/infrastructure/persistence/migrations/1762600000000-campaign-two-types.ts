import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Campanhas passam a ter só dois tipos: REGULAR e URGENT (o tipo sanguíneo continua opcional nos
 * dois). As campanhas "por tipo sanguíneo" viram URGENT: continuam avisando os doadores daquele tipo.
 */
export class CampaignTwoTypes1762600000000 implements MigrationInterface {
  name = 'CampaignTwoTypes1762600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "scheduling"."campaigns" SET "type" = 'URGENT' WHERE "type" = 'SPECIFIC_BLOOD_TYPE'`,
    );
    await queryRunner.query(
      'ALTER TYPE "scheduling"."campaigns_type_enum" RENAME TO "campaigns_type_enum_old"',
    );
    await queryRunner.query(
      `CREATE TYPE "scheduling"."campaigns_type_enum" AS ENUM('REGULAR', 'URGENT')`,
    );
    await queryRunner.query(
      'ALTER TABLE "scheduling"."campaigns" ALTER COLUMN "type" TYPE "scheduling"."campaigns_type_enum" USING "type"::text::"scheduling"."campaigns_type_enum"',
    );
    await queryRunner.query('DROP TYPE "scheduling"."campaigns_type_enum_old"');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "scheduling"."campaigns_type_enum" ADD VALUE IF NOT EXISTS 'SPECIFIC_BLOOD_TYPE'`,
    );
  }
}
