import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Coluna de versão dos agendamentos, para controle de concorrência otimista nas transições de estado. */
export class AppointmentVersion1761700000000 implements MigrationInterface {
  name = 'AppointmentVersion1761700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "scheduling"."appointments" ADD "version" integer NOT NULL DEFAULT 1',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "scheduling"."appointments" DROP COLUMN "version"');
  }
}
