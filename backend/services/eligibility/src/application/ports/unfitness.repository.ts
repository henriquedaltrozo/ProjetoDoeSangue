import type {
  TemporaryUnfitness,
  NewTemporaryUnfitness,
} from '../../domain/entities/temporary-unfitness';

export interface UnfitnessRepository {
  create(draft: NewTemporaryUnfitness): Promise<TemporaryUnfitness>;
  save(unfitness: TemporaryUnfitness): Promise<TemporaryUnfitness>;
  findByIdAndDonor(id: string, donorId: string): Promise<TemporaryUnfitness | null>;
  /** Mais recentes primeiro (por startDate). */
  listByDonor(donorId: string): Promise<TemporaryUnfitness[]>;
  /** Inaptidão em vigor em `todayISO` (ver `TemporaryUnfitness#isActiveAt`), se houver. */
  findActive(donorId: string, todayISO: string): Promise<TemporaryUnfitness | null>;
  /** Inaptidões em vigor em `todayISO` de vários doadores, numa só consulta. */
  listActiveForDonors(donorIds: string[], todayISO: string): Promise<TemporaryUnfitness[]>;
  /** Apaga o registro (correção de um registro feito por engano). */
  remove(id: string): Promise<void>;
  /** Substitui o motivo (texto livre) de todas as inaptidões do doador. */
  replaceReasons(donorId: string, reason: string): Promise<void>;
}

export const UNFITNESS_REPOSITORY = Symbol('UnfitnessRepository');
