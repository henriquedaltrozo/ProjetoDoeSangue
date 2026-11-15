import { DonationDateInFutureError } from '@src/domain/errors/domain.errors';
import { NotFoundError } from '@src/application/errors/application.errors';
import { CompleteDonationUseCase } from '@src/application/use-cases/complete-donation.use-case';
import { InMemoryDonorRepository, FixedClock } from '@test/support/in-memory-repositories.fake';
import { createTestDonor, dateWithOffset } from '@test/support/fixtures.fake';

describe('CompleteDonationUseCase', () => {
  let donors: InMemoryDonorRepository;
  let useCase: CompleteDonationUseCase;

  beforeEach(() => {
    donors = new InMemoryDonorRepository();
    useCase = new CompleteDonationUseCase(donors, new FixedClock());
  });

  it('atualiza lastDonationAt com hoje ao registrar a conclusão sem data', async () => {
    donors.seed(createTestDonor());
    const donor = await useCase.execute('donor-1');
    expect(donor.lastDonationAt).toBe(dateWithOffset(0));
  });

  it('é idempotente e usa a data informada', async () => {
    donors.seed(createTestDonor());
    const first = await useCase.execute('donor-1', '2026-09-01');
    expect(first.lastDonationAt).toBe('2026-09-01');
    const saves = donors.saves;

    await useCase.execute('donor-1', '2026-09-01');
    expect(donors.saves).toBe(saves);
  });

  it('evento atrasado: não recua a última doação, mas registra a doação no histórico anual', async () => {
    donors.seed(createTestDonor({ lastDonationAt: '2026-09-20', donationDates: ['2026-09-20'] }));
    const donor = await useCase.execute('donor-1', '2026-09-01');
    expect(donor.lastDonationAt).toBe('2026-09-20');
    expect(donors.items.get('donor-1')?.donationDates).toEqual(['2026-09-01', '2026-09-20']);
    expect(donors.saves).toBe(1);
  });

  it('repetir o mesmo evento (retry do outbox) não grava nada', async () => {
    donors.seed(createTestDonor({ lastDonationAt: '2026-09-20', donationDates: ['2026-09-20'] }));
    await useCase.execute('donor-1', '2026-09-20');
    expect(donors.saves).toBe(0);
  });

  it('rejeita data no futuro antes mesmo de procurar o doador', async () => {
    await expect(useCase.execute('donor-1', '2999-01-01')).rejects.toBeInstanceOf(
      DonationDateInFutureError,
    );
    await expect(useCase.execute('donor-1', '2999-01-01')).rejects.toThrow(/futuro/);
  });

  it('lança NotFoundError para doador inexistente', async () => {
    await expect(useCase.execute('not-exists')).rejects.toBeInstanceOf(NotFoundError);
  });
});
