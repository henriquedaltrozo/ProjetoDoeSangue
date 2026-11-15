import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Versão do doador (concorrência otimista: duas gravações simultâneas não se sobrescrevem) e a ação
 * SEARCH na auditoria (doador exibido numa busca do admin).
 */
export class DonorVersionAuditSearch1762000000000 implements MigrationInterface {
  name = 'DonorVersionAuditSearch1762000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "eligibility"."donors" ADD "version" integer NOT NULL DEFAULT 1',
    );
    await queryRunner.query(
      `ALTER TYPE "eligibility"."audit_accesses_action_enum" ADD VALUE IF NOT EXISTS 'SEARCH'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // O Postgres não remove um valor de enum; registros SEARCH viram VIEW e o tipo é recriado.
    await queryRunner.query(
      `UPDATE "eligibility"."audit_accesses" SET "action" = 'VIEW' WHERE "action" = 'SEARCH'`,
    );
    await queryRunner.query(
      `ALTER TYPE "eligibility"."audit_accesses_action_enum" RENAME TO "audit_accesses_action_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "eligibility"."audit_accesses_action_enum" AS ENUM('VIEW', 'UPDATE', 'EXPORT', 'ANONYMIZATION')`,
    );
    await queryRunner.query(
      'ALTER TABLE "eligibility"."audit_accesses" ALTER COLUMN "action" TYPE "eligibility"."audit_accesses_action_enum" USING "action"::text::"eligibility"."audit_accesses_action_enum"',
    );
    await queryRunner.query('DROP TYPE "eligibility"."audit_accesses_action_enum_old"');
    await queryRunner.query('ALTER TABLE "eligibility"."donors" DROP COLUMN "version"');
  }
}
