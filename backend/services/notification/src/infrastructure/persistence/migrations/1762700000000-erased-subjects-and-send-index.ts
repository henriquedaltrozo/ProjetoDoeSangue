import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * - `erased_subjects`: titulares que excluíram a conta (LGPD); e-mails deles que ainda estavam na
 *   fila não saem mais.
 * - índice (jobId, recipient) em `sent_notifications`: a checagem "este job já entregou a este
 *   destinatário?" roda a cada envio e, sem índice, ficaria mais lenta a cada e-mail gravado.
 */
export class ErasedSubjectsAndSendIndex1762700000000 implements MigrationInterface {
  name = 'ErasedSubjectsAndSendIndex1762700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE "notification"."erased_subjects" ("subjectId" uuid NOT NULL, "erasedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_bc65689d969b6f91d335c8342a8" PRIMARY KEY ("subjectId"))',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_a8253f377b5fadc9eb5d5cac92" ON "notification"."sent_notifications" ("jobId", "recipient") ',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "notification"."IDX_a8253f377b5fadc9eb5d5cac92"');
    await queryRunner.query('DROP TABLE "notification"."erased_subjects"');
  }
}
