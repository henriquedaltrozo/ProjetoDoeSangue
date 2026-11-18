import { BloodType } from '@shared/domain/enums';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import type { DonorPage, DonorRepository } from '../../../application/ports/donor.repository';
import type { Donor, NewDonor } from '../../../domain/entities/donor';
import { DonorMapper } from '../mappers/donor.mapper';
import { DonorOrmEntity } from '../orm-entities/donor.orm-entity';
import { cpfIndex, isUniqueViolation, nameWordIndexes } from '@shared/infrastructure/persistence';
import { ConflictError } from '../../../application/errors';

@Injectable()
export class DonorTypeOrmRepository implements DonorRepository {
  constructor(
    @InjectRepository(DonorOrmEntity) private readonly repo: Repository<DonorOrmEntity>,
  ) {}

  async findById(id: string): Promise<Donor | null> {
    const orm = await this.repo.findOne({ where: { id } });
    return orm ? DonorMapper.toDomain(orm) : null;
  }

  async findByUserId(userId: string): Promise<Donor | null> {
    const orm = await this.repo.findOne({ where: { userId } });
    return orm ? DonorMapper.toDomain(orm) : null;
  }

  async findByCpfOrUserId(cpf: string, userId: string): Promise<Donor | null> {
    const orm = await this.repo.findOne({ where: [{ cpfIndex: cpfIndex(cpf) }, { userId }] });
    return orm ? DonorMapper.toDomain(orm) : null;
  }

  async listAcceptingAlerts(bloodType?: BloodType): Promise<Donor[]> {
    const where: FindOptionsWhere<DonorOrmEntity> = {
      active: true,
      receiveAlerts: true,
      emailVerified: true,
    };
    if (bloodType) {
      where.bloodType = bloodType;
    }
    const donors = await this.repo.find({ where });
    return donors.map(DonorMapper.toDomain);
  }

  /**
   * Busca do painel admin. O nome e o CPF ficam cifrados, então a busca é por igualdade sobre índices
   * cegos (HMAC): um CPF completo (11 dígitos, com ou sem máscara) ou palavras inteiras do nome, sem
   * diferenciar acento nem maiúsculas ("silva jose" acha "José da Silva"; "sil" não acha). Ordena
   * pelo cadastro mais recente, com o id como desempate (a mesma pessoa não aparece em duas páginas).
   * Só doadores ativos: os anonimizados (conta excluída) não têm mais o que mostrar na busca.
   */
  async find(search: string | undefined, limit: number, offset = 0): Promise<DonorPage> {
    const query = this.repo
      .createQueryBuilder('d')
      .where('d.active = true')
      .orderBy('d.createdAt', 'DESC')
      .addOrderBy('d.id', 'ASC');
    if (search) {
      const term = search.trim();
      if (/^[\d.\-\s]+$/.test(term) && term.replace(/\D/g, '').length === 11) {
        query.andWhere('d.cpfIndex = :cpfIndex', { cpfIndex: cpfIndex(term) });
      } else {
        const words = nameWordIndexes(term);
        if (words.length === 0) return { items: [], total: 0 };
        query.andWhere('d.nameIndexes @> :words', { words });
      }
    }
    const [donors, total] = await query.skip(offset).take(limit).getManyAndCount();
    return { items: donors.map(DonorMapper.toDomain), total };
  }

  async findByIds(ids: string[]): Promise<Donor[]> {
    if (ids.length === 0) return [];
    const donors = await this.repo.find({ where: { id: In(ids) } });
    return donors.map(DonorMapper.toDomain);
  }

  async create(draft: NewDonor): Promise<Donor> {
    try {
      const saved = await this.repo.save(
        this.repo.create({
          ...draft,
          cpfIndex: cpfIndex(draft.cpf),
          nameIndexes: nameWordIndexes(draft.completeName),
        }),
      );
      return DonorMapper.toDomain(saved);
    } catch (err) {
      // Dois cadastros simultâneos com o mesmo CPF ou usuário: o índice único decide quem fica.
      if (isUniqueViolation(err)) {
        throw new ConflictError('Já existe um doador cadastrado com este CPF ou usuário.');
      }
      throw err;
    }
  }

  /**
   * Concorrência otimista: só grava se a versão no banco ainda é a que foi lida (a linha fica travada
   * até o fim da transação). Se outra operação gravou o doador nesse meio-tempo (ex.: o doador edita o
   * perfil enquanto a conclusão de uma doação é processada), nada é gravado e o caso de uso recebe um
   * ConflictError, em vez de sobrescrever a outra alteração. O TypeORM incrementa a versão ao gravar.
   */
  async save(donor: Donor): Promise<Donor> {
    return this.repo.manager.transaction(async (manager) => {
      const current = await manager.findOne(DonorOrmEntity, {
        where: { id: donor.id },
        select: { id: true, version: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!current || current.version !== donor.version) {
        throw new ConflictError(
          'O cadastro do doador foi alterado por outra operação. Recarregue e tente de novo.',
        );
      }
      try {
        const saved = await manager.save(DonorMapper.toOrm(donor));
        return DonorMapper.toDomain(saved);
      } catch (err) {
        // O doador trocou o CPF por um que já é de outro doador: o índice único recusa.
        if (isUniqueViolation(err)) {
          throw new ConflictError('Já existe um doador cadastrado com este CPF.');
        }
        throw err;
      }
    });
  }
}
