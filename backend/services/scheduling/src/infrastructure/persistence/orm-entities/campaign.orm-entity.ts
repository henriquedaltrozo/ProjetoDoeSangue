import { BloodType } from '@shared/domain/enums';
import { CampaignType } from '../../../domain/enums';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CollectionUnitOrmEntity } from './collection-unit.orm-entity';

/** Schema `scheduling`. Ver docs/01, seção 5.2. */
@Entity({ name: 'campaigns', schema: 'scheduling' })
export class CampaignOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: CampaignType })
  type: CampaignType;

  @Column({ type: 'enum', enum: BloodType, nullable: true })
  targetBloodType: BloodType | null;

  @ManyToOne(() => CollectionUnitOrmEntity, { nullable: true, onDelete: 'SET NULL' })
  collectionUnit: CollectionUnitOrmEntity | null;

  @Column({ type: 'uuid', nullable: true })
  collectionUnitId: string | null;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
