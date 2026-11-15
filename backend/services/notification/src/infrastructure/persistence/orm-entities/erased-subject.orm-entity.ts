import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * [LGPD] Titulares (usuário e/ou doador) que pediram a exclusão da conta. E-mails para eles que ainda
 * estavam na fila quando a exclusão chegou não são mais enviados nem gravados no log.
 */
@Entity({ name: 'erased_subjects', schema: 'notification' })
export class ErasedSubjectOrmEntity {
  /** Id do usuário (auth) ou do doador (eligibility). */
  @PrimaryColumn({ type: 'uuid' })
  subjectId: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  erasedAt: Date;
}
