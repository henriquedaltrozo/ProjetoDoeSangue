import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Se o doador confirmou o e-mail: campanhas e "já pode doar" só vão para quem confirmou. Os doadores
 * já cadastrados ficam como confirmados (o cadastro deles é anterior à confirmação).
 */
export class DonorEmailVerified1763000000000 implements MigrationInterface {
  name = 'DonorEmailVerified1763000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "eligibility"."donors" ADD "emailVerified" boolean NOT NULL DEFAULT true',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "eligibility"."donors" DROP COLUMN "emailVerified"');
  }
}
