import { NotFoundError } from '@src/application/errors';
import { UpdateDonorIdentityUseCase } from '@src/application/use-cases/update-donor-identity.use-case';
import { AuditAction } from '@src/domain/entities/access-audit';
import { createTestDonor } from '@test/support/fixtures.fake';
import {
  InMemoryDonorRepository,
  buildAuditTrail,
} from '@test/support/in-memory-repositories.fake';

describe('UpdateDonorIdentityUseCase', () => {
  let donors: InMemoryDonorRepository;
  let audit: ReturnType<typeof buildAuditTrail>;
  let useCase: UpdateDonorIdentityUseCase;

  beforeEach(() => {
    donors = new InMemoryDonorRepository();
    donors.seed(createTestDonor());
    audit = buildAuditTrail();
    useCase = new UpdateDonorIdentityUseCase(donors, audit.trail);
  });

  it('troca nome e e-mail e audita em nome do titular', async () => {
    const donor = await useCase.execute('donor-1', {
      completeName: 'Fulana de Tal',
      email: 'fulana@example.com',
    });
    expect(donor.completeName).toBe('Fulana de Tal');
    expect(donor.email).toBe('fulana@example.com');
    expect(audit.accesses.items).toEqual([
      expect.objectContaining({ donorId: 'donor-1', userId: 'user-1', action: AuditAction.UPDATE }),
    ]);
  });

  it('marca o e-mail como confirmado (o auth avisa quando o doador confirma pelo link)', async () => {
    donors.seed(createTestDonor({ id: 'donor-2', emailVerified: false }));

    await useCase.execute('donor-2', { emailVerified: true });

    expect(donors.items.get('donor-2')?.emailVerified).toBe(true);
  });

  it('lança NotFoundError para doador inexistente', async () => {
    await expect(
      useCase.execute('nao-existe', { completeName: 'Nome Novo' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
