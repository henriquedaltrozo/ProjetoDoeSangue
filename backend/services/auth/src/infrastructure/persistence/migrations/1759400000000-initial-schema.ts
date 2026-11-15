import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Schema inicial do auth-service, gerado a partir das entidades ORM. O schema Postgres
 * (`CREATE SCHEMA`) é criado pelo script de inicialização do banco (infra/postgres) antes do serviço subir.
 */
export class InitialSchema1759400000000 implements MigrationInterface {
  name = 'InitialSchema1759400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TYPE "auth"."users_role_enum" AS ENUM(\'donor\', \'admin\')');
    await queryRunner.query(
      'CREATE TABLE "auth"."users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "email" character varying(255) NOT NULL, "passwordHash" character varying(255) NOT NULL, "role" "auth"."users_role_enum" NOT NULL, "name" character varying(150) NOT NULL, "donorId" uuid, "active" boolean NOT NULL DEFAULT true, "loginFailures" integer NOT NULL DEFAULT \'0\', "blockedUntil" TIMESTAMP WITH TIME ZONE, "lastLoginAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "auth"."users" ("email") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_03b2dba9e6fd05f5625e30cd1f" ON "auth"."users" ("donorId") ',
    );
    await queryRunner.query(
      'CREATE TABLE "auth"."password_reset_tokens" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "tokenHash" character varying(64) NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "usedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d16bebd73e844c48bca50ff8d3d" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_1143abb8c3fad8b06dd857a8c9" ON "auth"."password_reset_tokens" ("tokenHash") ',
    );
    await queryRunner.query(
      'CREATE TABLE "auth"."refresh_tokens" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "tokenHash" character varying(64) NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "revokedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_c25bc63d248ca90e8dcc1d92d0" ON "auth"."refresh_tokens" ("tokenHash") ',
    );
    await queryRunner.query(
      'ALTER TABLE "auth"."password_reset_tokens" ADD CONSTRAINT "FK_d6a19d4b4f6c62dcd29daa497e2" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "auth"."refresh_tokens" ADD CONSTRAINT "FK_610102b60fea1455310ccd299de" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "auth"."refresh_tokens" DROP CONSTRAINT "FK_610102b60fea1455310ccd299de"',
    );
    await queryRunner.query(
      'ALTER TABLE "auth"."password_reset_tokens" DROP CONSTRAINT "FK_d6a19d4b4f6c62dcd29daa497e2"',
    );
    await queryRunner.query('DROP INDEX "auth"."IDX_c25bc63d248ca90e8dcc1d92d0"');
    await queryRunner.query('DROP TABLE "auth"."refresh_tokens"');
    await queryRunner.query('DROP INDEX "auth"."IDX_1143abb8c3fad8b06dd857a8c9"');
    await queryRunner.query('DROP TABLE "auth"."password_reset_tokens"');
    await queryRunner.query('DROP INDEX "auth"."IDX_03b2dba9e6fd05f5625e30cd1f"');
    await queryRunner.query('DROP INDEX "auth"."IDX_97672ac88f789774dd47f7c8be"');
    await queryRunner.query('DROP TABLE "auth"."users"');
    await queryRunner.query('DROP TYPE "auth"."users_role_enum"');
  }
}
