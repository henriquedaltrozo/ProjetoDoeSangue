import {
  decryptValue,
  encryptDeterministicLegacy,
  encryptValue,
} from '@shared/infrastructure/persistence';
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * O IV da cifra determinística passou a vir de uma subchave própria (ver encryptValue). O tipo
 * sanguíneo é buscado por igualdade do texto cifrado (campanhas por tipo sanguíneo), então os valores
 * gravados no formato anterior são regravados no novo: senão essa busca deixaria de encontrá-los.
 * Precisa de DATA_ENCRYPTION_KEY, como o próprio serviço.
 */
export class ReencryptBloodType1762100000000 implements MigrationInterface {
  name = 'ReencryptBloodType1762100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.rewrite(queryRunner, (plain) => encryptValue(plain, true));
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await this.rewrite(queryRunner, encryptDeterministicLegacy);
  }

  private async rewrite(
    queryRunner: QueryRunner,
    encrypt: (plain: string) => string,
  ): Promise<void> {
    const rows: { id: string; value: string }[] = await queryRunner.query(
      'SELECT id, "bloodType" AS value FROM "eligibility"."donors" WHERE "bloodType" IS NOT NULL',
    );
    for (const { id, value } of rows) {
      const next = encrypt(decryptValue(value));
      if (next !== value) {
        await queryRunner.query(
          'UPDATE "eligibility"."donors" SET "bloodType" = $1 WHERE id = $2',
          [next, id],
        );
      }
    }
  }
}
