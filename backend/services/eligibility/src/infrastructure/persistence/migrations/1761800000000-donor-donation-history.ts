import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Histórico de doações dos últimos 12 meses, necessário para o limite anual de doações (quatro para
 * homens e três para mulheres, Portaria GM/MS nº 11.685/2026, art. 38). Doadores existentes recebem
 * a última doação conhecida como único item do histórico.
 */
export class DonorDonationHistory1761800000000 implements MigrationInterface {
  name = 'DonorDonationHistory1761800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "eligibility"."donors" ADD "donationDates" jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `UPDATE "eligibility"."donors" SET "donationDates" = jsonb_build_array(to_char("lastDonationAt", 'YYYY-MM-DD')) WHERE "lastDonationAt" IS NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "eligibility"."donors" DROP COLUMN "donationDates"');
  }
}
