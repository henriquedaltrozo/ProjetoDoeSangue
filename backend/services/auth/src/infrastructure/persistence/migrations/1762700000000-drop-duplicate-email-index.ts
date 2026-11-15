import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * O e-mail já é único pela restrição UNIQUE da coluna; o índice único a mais repetia a mesma
 * garantia (e o custo de manter dois índices iguais a cada gravação).
 */
export class DropDuplicateEmailIndex1762700000000 implements MigrationInterface {
  name = 'DropDuplicateEmailIndex1762700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "auth"."IDX_97672ac88f789774dd47f7c8be"');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "auth"."users" ("email") ',
    );
  }
}
