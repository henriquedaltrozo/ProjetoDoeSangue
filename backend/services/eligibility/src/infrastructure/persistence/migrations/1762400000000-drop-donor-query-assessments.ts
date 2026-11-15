import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * As consultas do doador ("Posso doar hoje?") deixam de ser gravadas: só respondem na hora. As já
 * gravadas são apagadas (dado de saúde sem finalidade, LGPD). Nenhum agendamento aponta para elas:
 * o scheduling só referencia avaliações de agendamento. Não há volta: o que foi apagado não retorna.
 */
export class DropDonorQueryAssessments1762400000000 implements MigrationInterface {
  name = 'DropDonorQueryAssessments1762400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "eligibility"."eligibility_assessments" WHERE "origin" = 'DONOR_QUERY'`,
    );
  }

  async down(): Promise<void> {
    // Dados apagados não são restaurados.
  }
}
