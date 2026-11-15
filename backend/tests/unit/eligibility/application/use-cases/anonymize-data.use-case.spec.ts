import { Role } from '@shared/domain/enums';
import { NotFoundError } from '@src/application/errors';
import { AuditAction } from '@src/domain/entities/access-audit';
import { AnonymizeDataUseCase } from '@src/application/use-cases/anonymize-data.use-case';
import {
  InMemoryDonorRepository,
  InMemoryUnfitnessRepository,
  buildAuditTrail,
} from '@test/support/in-memory-repositories.fake';
import { createTestDonor, createTestUnfitness } from '@test/support/fixtures.fake';

describe('AnonymizeDataUseCase', () => {
  let donors: InMemoryDonorRepository;
  let unfitness: InMemoryUnfitnessRepository;
  let audit: ReturnType<typeof buildAuditTrail>;
  let useCase: AnonymizeDataUseCase;

  beforeEach(() => {
    donors = new InMemoryDonorRepository();
    unfitness = new InMemoryUnfitnessRepository();
    audit = buildAuditTrail();
    useCase = new AnonymizeDataUseCase(donors, unfitness, audit.trail);
  });

  it('descaracteriza nome/cpf/telefone/e-mail, desativa o doador e redige as inaptidões', async () => {
    donors.seed(createTestDonor({ permanentUnfitnessReason: 'algum motivo identificante' }));
    unfitness.seed(createTestUnfitness({ reason: 'motivo identificante' }));

    const result = await useCase.execute('donor-1');

    expect(result).toEqual({ userId: 'user-1' });
    const saved = donors.items.get('donor-1');
    expect(saved?.completeName).toBe('Doador anonimizado');
    expect(saved?.cpf).toHaveLength(11);
    expect(saved?.cpf).not.toBe('12345678901');
    expect(saved?.phone).toBeNull();
    expect(saved?.email).toBe('anon-donor-1@anonymized.local');
    expect(saved?.permanentUnfitnessReason).toBe('[dados removidos a pedido do titular]');
    expect(saved?.active).toBe(false);
    expect(unfitness.items[0].reason).toBe('[dados removidos a pedido do titular]');
    expect(audit.accesses.items).toEqual([
      expect.objectContaining({
        donorId: 'donor-1',
        userId: 'user-1',
        userRole: Role.DONOR,
        action: AuditAction.ANONYMIZATION,
      }),
    ]);
  });

  it('mantém permanentUnfitnessReason nulo quando já era nulo', async () => {
    donors.seed(createTestDonor({ id: 'donor-2', permanentUnfitnessReason: null }));
    await useCase.execute('donor-2');
    expect(donors.items.get('donor-2')?.permanentUnfitnessReason).toBeNull();
  });

  it('falha ao gravar o doador: nenhum motivo fica legível e repetir o pedido conclui', async () => {
    donors.seed(createTestDonor());
    unfitness.seed(createTestUnfitness({ reason: 'motivo identificante' }));
    const save = donors.save.bind(donors);
    donors.save = async () => {
      throw new Error('banco fora do ar');
    };

    await expect(useCase.execute('donor-1')).rejects.toThrow('banco fora do ar');
    expect(unfitness.items[0].reason).toBe('[dados removidos a pedido do titular]');

    donors.save = save;
    await useCase.execute('donor-1');
    expect(donors.items.get('donor-1')?.active).toBe(false);
  });

  it('lança NotFoundError ao anonimizar um doador inexistente', async () => {
    await expect(useCase.execute('not-exists')).rejects.toBeInstanceOf(NotFoundError);
  });
});
