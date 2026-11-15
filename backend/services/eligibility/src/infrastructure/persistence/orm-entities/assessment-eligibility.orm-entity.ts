import {
  AssessmentNotice,
  AssessmentSource,
  EligibilityResult,
  IneligibilityReason,
} from '@shared/domain/enums';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DonorOrmEntity } from './donor.orm-entity';

/** Log auditável de cada verificação de elegibilidade (a entidade "Elegibilidade" da modelagem). */
@Entity({ name: 'eligibility_assessments', schema: 'eligibility' })
export class EligibilityAssessmentOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DonorOrmEntity, { onDelete: 'CASCADE' })
  donor: DonorOrmEntity;

  @Index()
  @Column({ type: 'uuid' })
  donorId: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  appointmentId: string | null;

  @Column({ type: 'enum', enum: EligibilityResult })
  result: EligibilityResult;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  reasons: IneligibilityReason[];

  /** Avisos de uma avaliação apta (ex.: levar o termo do responsável). */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  notices: AssessmentNotice[];

  @Column({ type: 'date', nullable: true })
  nextEligibilityDate: string | null;

  @Column({ type: 'enum', enum: AssessmentSource })
  origin: AssessmentSource;

  @CreateDateColumn({ type: 'timestamptz' })
  assessedAt: Date;
}
