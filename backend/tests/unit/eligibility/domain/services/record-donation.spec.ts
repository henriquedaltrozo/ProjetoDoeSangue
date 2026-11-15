import { DonationDateInFutureError } from '@src/domain/errors/domain.errors';
import { calculateLastDonation, validateDonationDate } from '@src/domain/services/record-donation';

describe('registro de doação concluída', () => {
  const today = '2026-10-02';

  it('rejeita datas futuras e aceita hoje, passado ou omitida', () => {
    expect(() => validateDonationDate('2026-10-03', today)).toThrow(DonationDateInFutureError);
    expect(() => validateDonationDate(today, today)).not.toThrow();
    expect(() => validateDonationDate('2020-01-01', today)).not.toThrow();
    expect(() => validateDonationDate(undefined, today)).not.toThrow();
  });

  it('grava a data informada ou hoje quando não há doação anterior', () => {
    expect(calculateLastDonation(null, '2026-09-01', today)).toBe('2026-09-01');
    expect(calculateLastDonation(null, undefined, today)).toBe(today);
  });

  it('é idempotente e nunca recua a data', () => {
    expect(calculateLastDonation('2026-09-01', '2026-09-01', today)).toBeNull();
    expect(calculateLastDonation('2026-09-20', '2026-09-01', today)).toBeNull();
    expect(calculateLastDonation('2026-09-01', '2026-09-20', today)).toBe('2026-09-20');
  });
});
