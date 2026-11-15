import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Avisos da avaliação de elegibilidade guardados no agendamento (ex.: menor deve levar o termo do responsável). */
export class AppointmentEligibilityNotices1761900000000 implements MigrationInterface {
  name = 'AppointmentEligibilityNotices1761900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "scheduling"."appointments" ADD "eligibilityNotices" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "scheduling"."appointments" DROP COLUMN "eligibilityNotices"',
    );
  }
}
