import { AccessDeniedError, NotFoundError } from '@src/application/errors';
import { FindDonorByIdUseCase } from '@src/application/use-cases/find-donor-by-id.use-case';
import { FindDonorByUserUseCase } from '@src/application/use-cases/find-donor-by-user.use-case';
import { AuditAction } from '@src/domain/entities/access-audit';
import { ADMIN_ACTOR, createTestDonor, donorActor } from '@test/support/fixtures.fake';
import {
  InMemoryDonorRepository,
  buildAuditTrail,
} from '@test/support/in-memory-repositories.fake';

describe('FindDonorByIdUseCase', () => {
  let donors: InMemoryDonorRepository;
  let audit: ReturnType<typeof buildAuditTrail>;
  let useCase: FindDonorByIdUseCase;

  beforeEach(() => {
    donors = new InMemoryDonorRepository();
    donors.seed(createTestDonor());
    audit = buildAuditTrail();
    useCase = new FindDonorByIdUseCase(donors, audit.trail);
  });

  it('devolve o doador e audita a leitura (VIEW) em nome de quem leu', async () => {
    const donor = await useCase.execute('donor-1', ADMIN_ACTOR);
    expect(donor.id).toBe('donor-1');
    expect(audit.accesses.items).toEqual([
      expect.objectContaining({ donorId: 'donor-1', userId: 'admin-1', action: AuditAction.VIEW }),
    ]);
  });

  it('o próprio doador pode ler o seu perfil', async () => {
    await expect(useCase.execute('donor-1', donorActor('donor-1'))).resolves.toBeDefined();
  });

  it('outro doador não pode ler o perfil, e nada é auditado', async () => {
    await expect(useCase.execute('donor-1', donorActor('donor-2'))).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
    expect(audit.accesses.items).toHaveLength(0);
  });

  it('lança NotFoundError para um doador inexistente, sem auditar', async () => {
    await expect(useCase.execute('not-exists', ADMIN_ACTOR)).rejects.toThrow(
      new NotFoundError('Doador não encontrado.'),
    );
    expect(audit.accesses.items).toHaveLength(0);
  });
});

describe('FindDonorByUserUseCase', () => {
  it('devolve o doador pelo usuário e falha com mensagem própria quando não existe', async () => {
    const donors = new InMemoryDonorRepository();
    donors.seed(createTestDonor());
    const useCase = new FindDonorByUserUseCase(donors);
    expect((await useCase.execute('user-1')).id).toBe('donor-1');
    await expect(useCase.execute('without-user')).rejects.toThrow(
      'Doador não encontrado para este usuário.',
    );
  });
});
