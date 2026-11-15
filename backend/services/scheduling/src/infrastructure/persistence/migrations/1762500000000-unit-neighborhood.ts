import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bairro da unidade de coleta, num campo separado do endereço. Nulo nas unidades já cadastradas
 * (o bairro delas pode estar dentro do endereço); obrigatório nas novas (validado na API e no domínio).
 */
export class UnitNeighborhood1762500000000 implements MigrationInterface {
  name = 'UnitNeighborhood1762500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "scheduling"."collection_units" ADD "neighborhood" character varying(100)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "scheduling"."collection_units" DROP COLUMN "neighborhood"',
    );
  }
}
