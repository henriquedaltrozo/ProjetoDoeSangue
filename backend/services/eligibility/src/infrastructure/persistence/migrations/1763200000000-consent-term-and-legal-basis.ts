import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * [LGPD] Guarda, junto com o consentimento do cadastro, a versão do termo aceito e a base legal
 * aplicada a cada categoria de dado (art. 11, I, para os de saúde; art. 7º, I, para os demais).
 * Os cadastros anteriores ficam com as três colunas nulas: não há como saber o que foi aceito.
 */
export class ConsentTermAndLegalBasis1763200000000 implements MigrationInterface {
  name = 'ConsentTermAndLegalBasis1763200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "eligibility"."donors" ADD "consentTermVersion" character varying(20)',
    );
    await queryRunner.query(
      'ALTER TABLE "eligibility"."donors" ADD "healthDataLegalBasis" character varying(20)',
    );
    await queryRunner.query(
      'ALTER TABLE "eligibility"."donors" ADD "personalDataLegalBasis" character varying(20)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "eligibility"."donors" DROP COLUMN "personalDataLegalBasis"',
    );
    await queryRunner.query(
      'ALTER TABLE "eligibility"."donors" DROP COLUMN "healthDataLegalBasis"',
    );
    await queryRunner.query('ALTER TABLE "eligibility"."donors" DROP COLUMN "consentTermVersion"');
  }
}
