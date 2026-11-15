import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * O telefone deixa de ser pedido no cadastro: o doador informa no perfil, se quiser. Na
 * anonimização ele passa a ficar vazio (antes era trocado por 00000000000), e os já anonimizados
 * são limpos aqui.
 */
export class DonorPhoneOptional1762300000000 implements MigrationInterface {
  name = 'DonorPhoneOptional1762300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "eligibility"."donors" ALTER COLUMN "phone" DROP NOT NULL',
    );
    await queryRunner.query(
      `UPDATE "eligibility"."donors" SET "phone" = NULL WHERE "phone" = '00000000000'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "eligibility"."donors" SET "phone" = '00000000000' WHERE "phone" IS NULL`,
    );
    await queryRunner.query('ALTER TABLE "eligibility"."donors" ALTER COLUMN "phone" SET NOT NULL');
  }
}
