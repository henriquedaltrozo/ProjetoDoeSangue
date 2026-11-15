import {
  FindDonorsUseCase,
  DONORS_PAGE_SIZE,
  DONORS_SEARCH_LIMIT,
} from '@src/application/use-cases/find-donors.use-case';
import { AuditAction } from '@src/domain/entities/access-audit';
import { ADMIN_ACTOR, createTestDonor } from '@test/support/fixtures.fake';
import {
  InMemoryDonorRepository,
  buildAuditTrail,
} from '@test/support/in-memory-repositories.fake';

describe('FindDonorsUseCase', () => {
  let donors: InMemoryDonorRepository;
  let audit: ReturnType<typeof buildAuditTrail>;
  let useCase: FindDonorsUseCase;

  beforeEach(() => {
    donors = new InMemoryDonorRepository();
    donors.seed(
      createTestDonor({ id: 'd-2', completeName: 'Zélia', cpf: '22222222222' }),
      createTestDonor({ id: 'd-1', completeName: 'Fulano de Tal', cpf: '11111111111' }),
    );
    audit = buildAuditTrail();
    useCase = new FindDonorsUseCase(donors, audit.trail);
  });

  it('lista todos os doadores, ordenados por nome, quando nenhuma busca é informada', async () => {
    const result = await useCase.execute(undefined, ADMIN_ACTOR);
    expect(result.map((d) => d.id)).toEqual(['d-1', 'd-2']);
  });

  it('filtra por nome ou CPF parcial quando a busca é informada', async () => {
    expect((await useCase.execute('fulano', ADMIN_ACTOR)).map((d) => d.id)).toEqual(['d-1']);
    expect((await useCase.execute('2222', ADMIN_ACTOR)).map((d) => d.id)).toEqual(['d-2']);
  });

  it('registra na auditoria cada doador exibido na busca', async () => {
    await useCase.execute('fulano', ADMIN_ACTOR);
    expect(audit.accesses.items).toEqual([
      expect.objectContaining({ donorId: 'd-1', action: AuditAction.SEARCH }),
    ]);
  });

  it('busca pelos ids (sem repetir) e audita cada doador exibido', async () => {
    const result = await useCase.execute('ignorado', ADMIN_ACTOR, ['d-2', 'd-2', 'nao-existe']);
    expect(result.map((d) => d.id)).toEqual(['d-2']);
    expect(audit.accesses.items.map((a) => a.donorId)).toEqual(['d-2']);
  });

  it('limita os resultados da busca administrativa', async () => {
    const spy = jest.spyOn(donors, 'find');
    await useCase.execute('x', ADMIN_ACTOR);
    expect(spy).toHaveBeenCalledWith('x', DONORS_SEARCH_LIMIT);
    expect(DONORS_SEARCH_LIMIT).toBe(50);
  });

  describe('searchPage', () => {
    beforeEach(() => {
      // 25 doadores "Maria ..." (mais que uma página) além dos dois do início.
      for (let i = 1; i <= 25; i++) {
        const n = String(i).padStart(2, '0');
        donors.seed(
          createTestDonor({ id: `m-${n}`, completeName: `Maria ${n}`, cpf: `333333333${n}` }),
        );
      }
    });

    it('devolve a página pedida, ordenada por nome, com o total encontrado', async () => {
      const first = await useCase.searchPage('maria', 1, ADMIN_ACTOR);
      expect(first).toMatchObject({ total: 25, page: 1, pageSize: DONORS_PAGE_SIZE });
      expect(first.items).toHaveLength(DONORS_PAGE_SIZE);
      expect(first.items[0]?.completeName).toBe('Maria 01');

      const second = await useCase.searchPage('maria', 2, ADMIN_ACTOR);
      expect(second.items.map((d) => d.completeName)).toEqual([
        'Maria 21',
        'Maria 22',
        'Maria 23',
        'Maria 24',
        'Maria 25',
      ]);
    });

    it('audita só os doadores da página exibida', async () => {
      await useCase.searchPage('maria', 2, ADMIN_ACTOR);
      expect(audit.accesses.items.map((a) => a.donorId)).toEqual([
        'm-21',
        'm-22',
        'm-23',
        'm-24',
        'm-25',
      ]);
    });
  });
});
