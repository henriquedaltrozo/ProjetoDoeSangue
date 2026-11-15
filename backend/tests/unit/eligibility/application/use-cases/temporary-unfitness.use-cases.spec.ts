import { AccessDeniedError, NotFoundError } from '@src/application/errors';
import { DeleteUnfitnessUseCase } from '@src/application/use-cases/delete-unfitness.use-case';
import { EndUnfitnessUseCase } from '@src/application/use-cases/end-unfitness.use-case';
import { ListUnfitnessUseCase } from '@src/application/use-cases/list-unfitness.use-case';
import { RegisterTemporaryUnfitnessUseCase } from '@src/application/use-cases/register-temporary-unfitness.use-case';
import { AuditAction } from '@src/domain/entities/access-audit';
import { UnfitnessCategory } from '@src/domain/enums';
import { UnfitnessAlreadyEndedError } from '@src/domain/errors';
import {
  ADMIN_ACTOR,
  createTestDonor,
  createTestUnfitness,
  dateWithOffset,
  donorActor,
} from '@test/support/fixtures.fake';
import {
  FixedClock,
  InMemoryDonorRepository,
  InMemoryUnfitnessRepository,
  buildAuditTrail,
} from '@test/support/in-memory-repositories.fake';

describe('Casos de uso de inaptidão temporária', () => {
  let donors: InMemoryDonorRepository;
  let unfitness: InMemoryUnfitnessRepository;
  let audit: ReturnType<typeof buildAuditTrail>;

  beforeEach(() => {
    donors = new InMemoryDonorRepository();
    donors.seed(createTestDonor());
    unfitness = new InMemoryUnfitnessRepository();
    audit = buildAuditTrail();
  });

  describe('DeleteUnfitnessUseCase', () => {
    it('exclui a inaptidão do doador e audita (UPDATE)', async () => {
      unfitness.seed(createTestUnfitness());
      await new DeleteUnfitnessUseCase(unfitness, audit.trail).execute(
        'donor-1',
        'unfitness-1',
        ADMIN_ACTOR,
      );
      expect(unfitness.items).toHaveLength(0);
      expect(audit.accesses.items.map((a) => a.action)).toEqual([AuditAction.UPDATE]);
    });

    it('não exclui inaptidão de outro doador nem inexistente', async () => {
      unfitness.seed(createTestUnfitness());
      const useCase = new DeleteUnfitnessUseCase(unfitness, audit.trail);
      await expect(useCase.execute('donor-2', 'unfitness-1', ADMIN_ACTOR)).rejects.toBeInstanceOf(
        NotFoundError,
      );
      await expect(useCase.execute('donor-1', 'nao-existe', ADMIN_ACTOR)).rejects.toBeInstanceOf(
        NotFoundError,
      );
      expect(unfitness.items).toHaveLength(1);
    });
  });

  describe('RegisterTemporaryUnfitnessUseCase', () => {
    it('registra o período em aberto, com quem registrou, e audita (UPDATE)', async () => {
      const useCase = new RegisterTemporaryUnfitnessUseCase(donors, unfitness, audit.trail);
      const registered = await useCase.execute(
        'donor-1',
        { reason: 'tatuagem', category: UnfitnessCategory.OTHER, startDate: dateWithOffset(0) },
        ADMIN_ACTOR,
      );
      expect(registered.actualEndDate).toBeNull();
      expect(registered.expectedEndDate).toBeNull();
      expect(registered.registeredBy).toBe('admin-1');
      expect(unfitness.items).toHaveLength(1);
      expect(audit.accesses.items).toEqual([
        expect.objectContaining({ userId: 'admin-1', action: AuditAction.UPDATE }),
      ]);
    });

    it('falha quando o doador não existe, sem auditar', async () => {
      const useCase = new RegisterTemporaryUnfitnessUseCase(donors, unfitness, audit.trail);
      await expect(
        useCase.execute(
          'not-exists',
          { reason: 'x', category: UnfitnessCategory.OTHER, startDate: dateWithOffset(0) },
          ADMIN_ACTOR,
        ),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(audit.accesses.items).toHaveLength(0);
    });
  });

  describe('ListUnfitnessUseCase', () => {
    it('lista as mais recentes primeiro, audita (VIEW) e falha para doador inexistente', async () => {
      unfitness.seed(
        createTestUnfitness({ id: 'i-antiga', startDate: dateWithOffset(-30) }),
        createTestUnfitness({ id: 'i-new', startDate: dateWithOffset(-2) }),
      );
      const useCase = new ListUnfitnessUseCase(donors, unfitness, audit.trail);
      expect((await useCase.execute('donor-1', ADMIN_ACTOR)).map((i) => i.id)).toEqual([
        'i-new',
        'i-antiga',
      ]);
      expect(audit.accesses.items.map((a) => a.action)).toEqual([AuditAction.VIEW]);
      await expect(useCase.execute('not-exists', ADMIN_ACTOR)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it('outro doador não pode listar as inaptidões', async () => {
      const useCase = new ListUnfitnessUseCase(donors, unfitness, audit.trail);
      await expect(useCase.execute('donor-1', donorActor('donor-2'))).rejects.toBeInstanceOf(
        AccessDeniedError,
      );
    });
  });

  describe('EndUnfitnessUseCase', () => {
    let useCase: EndUnfitnessUseCase;

    beforeEach(() => {
      useCase = new EndUnfitnessUseCase(unfitness, new FixedClock(), audit.trail);
      unfitness.seed(createTestUnfitness());
    });

    it('define actualEndDate com a data informada e audita (UPDATE)', async () => {
      const ended = await useCase.execute(
        'donor-1',
        'unfitness-1',
        { actualEndDate: '2026-09-30' },
        ADMIN_ACTOR,
      );
      expect(ended.actualEndDate).toBe('2026-09-30');
      expect(audit.accesses.items.map((a) => a.action)).toEqual([AuditAction.UPDATE]);
    });

    it('usa a data de hoje quando actualEndDate não é informada', async () => {
      const ended = await useCase.execute('donor-1', 'unfitness-1', {}, ADMIN_ACTOR);
      expect(ended.actualEndDate).toBe(dateWithOffset(0));
    });

    it('lança NotFoundError quando a inaptidão não existe (ou não é do doador)', async () => {
      await expect(
        useCase.execute('donor-1', 'not-exists', {}, ADMIN_ACTOR),
      ).rejects.toBeInstanceOf(NotFoundError);
      await expect(useCase.execute('other-donor', 'unfitness-1', {}, ADMIN_ACTOR)).rejects.toThrow(
        'Período de inaptidão não encontrado.',
      );
    });

    it('lança UnfitnessAlreadyEndedError quando a inaptidão já foi encerrada', async () => {
      await useCase.execute('donor-1', 'unfitness-1', { actualEndDate: '2026-09-29' }, ADMIN_ACTOR);
      await expect(
        useCase.execute('donor-1', 'unfitness-1', {}, ADMIN_ACTOR),
      ).rejects.toBeInstanceOf(UnfitnessAlreadyEndedError);
    });
  });
});
