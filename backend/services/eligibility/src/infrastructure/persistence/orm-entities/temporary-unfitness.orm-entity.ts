import { UnfitnessCategory } from '../../../domain/enums';
import { encryptedColumn } from '@shared/infrastructure/persistence';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DonorOrmEntity } from './donor.orm-entity';

/**
 * Períodos de inaptidão temporária (tatuagem, gravidez, viagem a área de
 * malária, etc.) - "está inapto agora" é calculado a partir das datas, não
 * um flag persistido (ver docs/01, seção 4.2).
 */
@Entity({ name: 'temporary_unfitness', schema: 'eligibility' })
export class TemporaryUnfitnessOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DonorOrmEntity, { onDelete: 'CASCADE' })
  donor: DonorOrmEntity;

  @Index()
  @Column({ type: 'uuid' })
  donorId: string;

  /**
   * Dado de saúde (texto livre, ex.: "tatuagem recente") - cifrado em
   * repouso. Não precisa ser determinístico (não é usado em busca/índice),
   * então a coluna vira `text` para caber o texto cifrado em base64.
   */
  @Column({ type: 'text', transformer: encryptedColumn<string>() })
  reason: string;

  @Column({ type: 'enum', enum: UnfitnessCategory })
  category: UnfitnessCategory;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date', nullable: true })
  expectedEndDate: string | null;

  @Column({ type: 'date', nullable: true })
  actualEndDate: string | null;

  @Column({ type: 'uuid', nullable: true })
  registeredBy: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
