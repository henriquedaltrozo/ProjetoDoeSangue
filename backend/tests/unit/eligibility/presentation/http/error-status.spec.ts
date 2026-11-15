import { HttpStatus } from '@nestjs/common';
import { BusinessErrorsFilter } from '@shared/presentation/http';
import { DonationDateInFutureError, UnfitnessAlreadyEndedError } from '@src/domain/errors';

describe('status HTTP dos erros do eligibility', () => {
  const filter = new BusinessErrorsFilter();

  it('data de doação no futuro é entrada inválida (400)', () => {
    expect(filter.statusOf(new DonationDateInFutureError())).toBe(HttpStatus.BAD_REQUEST);
  });

  it('encerrar uma inaptidão já encerrada conflita com o estado (409)', () => {
    expect(filter.statusOf(new UnfitnessAlreadyEndedError())).toBe(HttpStatus.CONFLICT);
  });
});
