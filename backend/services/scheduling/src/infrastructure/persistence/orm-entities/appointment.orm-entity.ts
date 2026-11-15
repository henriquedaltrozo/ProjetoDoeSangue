import type { AssessmentNotice } from '@shared/domain/enums';
import { AppointmentStatus } from '../../../domain/enums';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { CampaignOrmEntity } from './campaign.orm-entity';
import { CollectionUnitOrmEntity } from './collection-unit.orm-entity';

/**
 * Schema `scheduling`. Ver docs/01, seção 5.3, e o diagrama de sequência
 * (docs/02) para o significado de cada status na transição.
 */
@Entity({ name: 'appointments', schema: 'scheduling' })
@Index(['collectionUnitId', 'dateTime'])
export class AppointmentOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Referência lógica a eligibility.donors.id - sem FK entre schemas (ver docs/01, seção 1). */
  @Index()
  @Column({ type: 'uuid' })
  donorId: string;

  @ManyToOne(() => CollectionUnitOrmEntity, { onDelete: 'RESTRICT' })
  collectionUnit: CollectionUnitOrmEntity;

  @Column({ type: 'uuid' })
  collectionUnitId: string;

  @ManyToOne(() => CampaignOrmEntity, { nullable: true, onDelete: 'SET NULL' })
  campaign: CampaignOrmEntity | null;

  @Column({ type: 'uuid', nullable: true })
  campaignId: string | null;

  @Column({ type: 'timestamptz' })
  dateTime: Date;

  @Column({ type: 'enum', enum: AppointmentStatus, default: AppointmentStatus.SCHEDULED })
  status: AppointmentStatus;

  /** Referência lógica a eligibility.eligibility_assessments.id. */
  @Column({ type: 'uuid', nullable: true })
  assessmentEligibilityId: string | null;

  /** Avisos da avaliação que confirmou o agendamento (ex.: levar o termo do responsável). */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  eligibilityNotices: AssessmentNotice[];

  @Column({ type: 'text', nullable: true })
  cancellationReason: string | null;

  /** Quando o doador (ou um admin) confirmou a presença; nulo enquanto não confirmou. */
  @Column({ type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  checkinAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  /** Controle de concorrência otimista (ver AppointmentTypeOrmRepository.save). */
  @VersionColumn({ default: 1 })
  version: number;
}
