import { Sex, BloodType } from '@shared/domain/enums';
import { encryptedColumn } from '@shared/infrastructure/persistence';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

/** Schema `eligibility`. Dono dos dados cadastrais/clínicos do doador (ver docs/01). */
@Entity({ name: 'donors', schema: 'eligibility' })
export class DonorOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  userId: string;

  /** Dado identificante: cifrado em repouso (a busca por nome usa `nameIndexes`). */
  @Column({ type: 'text', transformer: encryptedColumn<string>() })
  completeName: string;

  /**
   * Índices cegos (HMAC) das palavras do nome, para a busca do painel admin por palavra inteira, sem
   * acento nem maiúsculas. Mantido junto com `completeName` (ver DonorMapper e o repositório).
   */
  @Index('IDX_donors_name_indexes', { synchronize: false })
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  nameIndexes: string[];

  /**
   * Cifrado em repouso (IV aleatório). A unicidade e a busca exata usam `cpfIndex`, o índice cego
   * (HMAC) do CPF: a cifra com IV aleatório não permite comparar valores iguais.
   */
  @Column({ type: 'text', transformer: encryptedColumn<string>() })
  cpf: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  cpfIndex: string;

  /** AAAA-MM-DD, cifrado em repouso (com o CPF e o nome, identifica a pessoa). */
  @Column({ type: 'text', transformer: encryptedColumn<string>() })
  birthDate: string;

  @Column({ type: 'enum', enum: Sex })
  sex: Sex;

  /** Opcional: informado pelo doador no perfil, se quiser. */
  @Column({ type: 'text', nullable: true, transformer: encryptedColumn<string>() })
  phone: string | null;

  @Column({ type: 'text', transformer: encryptedColumn<string>() })
  email: string;

  /**
   * Dado de saúde - cifrado em repouso (ver docs/01, seção sobre proteção
   * de dados sensíveis). A coluna precisa ser `varchar` (não `decimal`
   * nativo) porque o que é persistido é o texto cifrado, não o número.
   */
  @Column({
    type: 'varchar',
    length: 255,
    transformer: encryptedColumn<number>({ parse: Number }),
  })
  weightKg: number;

  /**
   * Dado de saúde - cifrado em repouso com IV determinístico: o
   * eligibility-service filtra doadores por tipo sanguíneo exato em
   * `listContacts` (campanhas de urgência), então o texto cifrado precisa
   * ser igual para o mesmo valor (ver `encryptedColumn`, opção
   * `deterministic`, para o trade-off aceito nisso).
   */
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    transformer: encryptedColumn<BloodType>({
      deterministic: true,
      parse: (raw) => raw as BloodType,
    }),
  })
  bloodType: BloodType | null;

  @Index()
  @Column({ type: 'date', nullable: true })
  lastDonationAt: string | null;

  /** Datas das doações dos últimos 12 meses (limite anual de doações da Portaria 11.685/2026). */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  donationDates: string[];

  @Column({ type: 'boolean', default: false })
  permanentUnfit: boolean;

  /** Dado de saúde (texto livre) - cifrado em repouso. */
  @Column({ type: 'text', nullable: true, transformer: encryptedColumn<string>() })
  permanentUnfitnessReason: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  /** Nome do responsável legal (menores de 18): dado pessoal de terceiro, cifrado em repouso. */
  @Column({ type: 'text', nullable: true, transformer: encryptedColumn<string>() })
  guardianName: string | null;

  @Column({ type: 'boolean', default: false })
  guardianConsentDeclared: boolean;

  /** Declarou ter doado antes dos 60 anos (null = não respondeu). */
  @Column({ type: 'boolean', nullable: true })
  donatedBefore60: boolean | null;

  @Column({ type: 'boolean', default: false })
  regularDonorDeclared: boolean;

  /** Avaliação médica favorável para doar com 70 anos ou mais. */
  @Column({ type: 'date', nullable: true })
  medicalClearanceAt: string | null;

  @Column({ type: 'uuid', nullable: true })
  medicalClearanceBy: string | null;

  /** [LGPD] Quando o doador consentiu com o uso dos dados de saúde (null em cadastros antigos). */
  @Column({ type: 'timestamptz', nullable: true })
  healthDataConsentAt: Date | null;

  /** [LGPD] Versão do termo de consentimento aceito no cadastro (null em cadastros antigos). */
  @Column({ type: 'varchar', length: 20, nullable: true })
  consentTermVersion: string | null;

  /** [LGPD] Base legal dos dados de saúde (art. 11) aplicada no cadastro. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  healthDataLegalBasis: string | null;

  /** [LGPD] Base legal dos demais dados pessoais (art. 7º) aplicada no cadastro. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  personalDataLegalBasis: string | null;

  /** Aceita avisos de campanhas e de "já pode doar" por e-mail (desmarcado no perfil). */
  @Column({ type: 'boolean', default: true })
  receiveAlerts: boolean;

  /** Confirmou o e-mail (campanhas e "já pode doar" só para quem confirmou). */
  @Column({ type: 'boolean', default: true })
  emailVerified: boolean;

  /** Concorrência otimista (ver DonorTypeOrmRepository.save). */
  @VersionColumn({ default: 1 })
  version: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
