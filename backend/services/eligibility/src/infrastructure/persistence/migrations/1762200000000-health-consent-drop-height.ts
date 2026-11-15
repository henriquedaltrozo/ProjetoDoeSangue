import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * [LGPD] Guarda quando o doador consentiu com o uso dos dados de saúde (coletado no cadastro) e
 * remove a altura: nenhuma regra a usava, e dado de saúde sem uso não deve ser coletado
 * (minimização). Desfazer recria a coluna vazia: as alturas apagadas não voltam.
 */
export class HealthConsentDropHeight1762200000000 implements MigrationInterface {
  name = 'HealthConsentDropHeight1762200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "eligibility"."donors" ADD "healthDataConsentAt" TIMESTAMP WITH TIME ZONE',
    );
    await queryRunner.query('ALTER TABLE "eligibility"."donors" DROP COLUMN "heightCm"');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "eligibility"."donors" ADD "heightCm" character varying(255)',
    );
    await queryRunner.query('ALTER TABLE "eligibility"."donors" DROP COLUMN "healthDataConsentAt"');
  }
}
