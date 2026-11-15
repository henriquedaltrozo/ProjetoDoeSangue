import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Preferência do doador por avisos que não são resposta a algo que ele fez (campanhas urgentes e
 * "você já pode doar"). Começa marcada para todos; o doador desmarca no perfil.
 */
export class DonorReceiveAlerts1762800000000 implements MigrationInterface {
  name = 'DonorReceiveAlerts1762800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "eligibility"."donors" ADD "receiveAlerts" boolean NOT NULL DEFAULT true',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "eligibility"."donors" DROP COLUMN "receiveAlerts"');
  }
}
