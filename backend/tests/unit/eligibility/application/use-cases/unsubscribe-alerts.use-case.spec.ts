import { InvalidEntryError } from '@src/application/errors';
import { UnsubscribeAlertsUseCase } from '@src/application/use-cases/unsubscribe-alerts.use-case';
import { AuditAction } from '@src/domain/entities/access-audit';
import { createTestDonor } from '@test/support/fixtures.fake';
import {
  FixedClock,
  InMemoryDonorRepository,
  buildAuditTrail,
} from '@test/support/in-memory-repositories.fake';

describe('UnsubscribeAlertsUseCase', () => {
  let donors: InMemoryDonorRepository;
  let audit: ReturnType<typeof buildAuditTrail>;
  let useCase: UnsubscribeAlertsUseCase;
  const tokens = { verify: (t: string) => (t === 'valido' ? 'donor-1' : null) };

  beforeEach(() => {
    donors = new InMemoryDonorRepository();
    audit = buildAuditTrail();
    useCase = new UnsubscribeAlertsUseCase(tokens, donors, new FixedClock(), audit.trail);
  });

  it('desmarca os avisos do doador do link e audita em nome dele', async () => {
    donors.seed(createTestDonor());

    await useCase.execute('valido');

    expect(donors.items.get('donor-1')?.receiveAlerts).toBe(false);
    expect(audit.accesses.items).toEqual([
      expect.objectContaining({ donorId: 'donor-1', userId: 'user-1', action: AuditAction.UPDATE }),
    ]);
  });

  it('repetir não muda nada (nem audita de novo)', async () => {
    donors.seed(createTestDonor({ receiveAlerts: false }));

    await useCase.execute('valido');

    expect(audit.accesses.items).toEqual([]);
  });

  it('token inválido ou ausente: erro de entrada', async () => {
    await expect(useCase.execute('falso')).rejects.toBeInstanceOf(InvalidEntryError);
    await expect(useCase.execute(undefined)).rejects.toBeInstanceOf(InvalidEntryError);
  });
});
