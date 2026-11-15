import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Outbox dos avisos de segurança da conta (senha e e-mail alterados): gravados na mesma transação da
 * mudança e entregues à fila depois, com novas tentativas.
 */
export class AccountNotices1762800000000 implements MigrationInterface {
  name = 'AccountNotices1762800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE "auth"."account_notices" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "payload" jsonb NOT NULL, "attempts" integer NOT NULL DEFAULT \'0\', "nextAttemptAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "lastError" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5cd2b00d3fca5fa569dd75b3592" PRIMARY KEY ("id"))',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "auth"."account_notices"');
  }
}
