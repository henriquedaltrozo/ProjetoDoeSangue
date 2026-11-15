import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Confirmação do e-mail: quando o dono confirmou (`emailVerifiedAt`) e o e-mail pedido numa troca,
 * à espera de confirmação (`pendingEmail`). As contas que já existiam contam como confirmadas: foram
 * criadas antes da confirmação existir.
 */
export class EmailVerification1763000000000 implements MigrationInterface {
  name = 'EmailVerification1763000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "auth"."users" ADD "emailVerifiedAt" TIMESTAMP WITH TIME ZONE, ADD "pendingEmail" character varying(255)',
    );
    await queryRunner.query('UPDATE "auth"."users" SET "emailVerifiedAt" = "createdAt"');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "auth"."users" DROP COLUMN "pendingEmail", DROP COLUMN "emailVerifiedAt"',
    );
  }
}
