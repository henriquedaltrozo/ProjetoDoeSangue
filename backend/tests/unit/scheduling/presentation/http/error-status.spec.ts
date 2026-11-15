import { HttpStatus } from '@nestjs/common';
import { BusinessErrorsFilter } from '@shared/presentation/http';
import { ExpiredError, InvalidEntryError, UnknownEventTypeError } from '@src/application/errors';
import { BusinessRuleError, InvalidValueError } from '@src/domain/errors';
import { SCHEDULING_ERROR_STATUS } from '@src/presentation/http/error-status';

describe('status HTTP dos erros do scheduling', () => {
  const filter = new BusinessErrorsFilter(SCHEDULING_ERROR_STATUS);

  it.each([
    [new InvalidEntryError('x'), HttpStatus.BAD_REQUEST],
    [new ExpiredError('x'), HttpStatus.GONE],
    [new BusinessRuleError('x'), HttpStatus.CONFLICT],
    [new InvalidValueError('x'), HttpStatus.BAD_REQUEST],
    [new UnknownEventTypeError('X'), HttpStatus.INTERNAL_SERVER_ERROR],
  ])('%p', (error, expected) => {
    expect(filter.statusOf(error)).toBe(expected);
  });
});
