import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Declarações do doador (o sistema não tem o histórico de doações de fora dele): responsável legal
 * de menores, doação antes dos 60, doador regular aos 70+ e a avaliação médica registrada por um
 * admin. E os avisos de uma avaliação apta (ex.: levar o termo do responsável).
 */
export class DonorDeclarations1761900000000 implements MigrationInterface {
  name = 'DonorDeclarations1761900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "eligibility"."donors"
         ADD "guardianName" text,
         ADD "guardianConsentDeclared" boolean NOT NULL DEFAULT false,
         ADD "donatedBefore60" boolean,
         ADD "regularDonorDeclared" boolean NOT NULL DEFAULT false,
         ADD "medicalClearanceAt" date,
         ADD "medicalClearanceBy" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "eligibility"."eligibility_assessments" ADD "notices" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "eligibility"."eligibility_assessments" DROP COLUMN "notices"',
    );
    await queryRunner.query(
      `ALTER TABLE "eligibility"."donors"
         DROP COLUMN "guardianName",
         DROP COLUMN "guardianConsentDeclared",
         DROP COLUMN "donatedBefore60",
         DROP COLUMN "regularDonorDeclared",
         DROP COLUMN "medicalClearanceAt",
         DROP COLUMN "medicalClearanceBy"`,
    );
  }
}
