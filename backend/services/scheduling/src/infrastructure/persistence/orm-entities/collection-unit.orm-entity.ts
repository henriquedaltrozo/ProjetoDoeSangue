import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Schema `scheduling`. Ver docs/01, seção 5.1. */
@Entity({ name: 'collection_units', schema: 'scheduling' })
export class CollectionUnitOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  address: string;

  /** Bairro. Nulo nas unidades cadastradas antes do campo existir; obrigatório nas novas. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  neighborhood: string | null;

  @Column({ type: 'varchar', length: 100 })
  city: string;

  @Column({ type: 'char', length: 2 })
  uf: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column({ type: 'integer' })
  simultaneousCapacity: number;

  /** Estrutura por dia da semana, ex: {"seg": ["08:00-17:00"]}. Informativo por enquanto. */
  @Column({ type: 'jsonb', nullable: true })
  operatingHours: Record<string, string[]> | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
