import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `userId` e `cpf` já são únicos pelas restrições UNIQUE das colunas; os índices únicos a mais
 * repetiam a mesma garantia (e o custo de manter dois índices iguais a cada gravação).
 */
export class DropDuplicateDonorIndexes1762700000000 implements MigrationInterface {
  name = 'DropDuplicateDonorIndexes1762700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "eligibility"."IDX_293976165d17c888acc7e254fa"');
    await queryRunner.query('DROP INDEX "eligibility"."IDX_97266aaad343e6ba70c0d82919"');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_97266aaad343e6ba70c0d82919" ON "eligibility"."donors" ("cpf") ',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_293976165d17c888acc7e254fa" ON "eligibility"."donors" ("userId") ',
    );
  }
}
