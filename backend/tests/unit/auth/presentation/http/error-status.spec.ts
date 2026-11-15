import { HttpStatus } from '@nestjs/common';
import { BusinessErrorsFilter } from '@shared/presentation/http';
import {
  AccessDeniedError,
  DependencyUnavailableError,
  ManyAttemptsError,
  NotAuthenticatedError,
} from '@src/application/errors';
import { LastAdminActiveError } from '@src/domain/errors';
import { AUTH_ERROR_STATUS } from '@src/presentation/http/error-status';

describe('status HTTP dos erros do auth', () => {
  const filter = new BusinessErrorsFilter(AUTH_ERROR_STATUS);

  it.each([
    [new NotAuthenticatedError(), HttpStatus.UNAUTHORIZED],
    [new ManyAttemptsError('x'), HttpStatus.TOO_MANY_REQUESTS],
    [new AccessDeniedError('x'), HttpStatus.FORBIDDEN],
    [new DependencyUnavailableError('x'), HttpStatus.BAD_GATEWAY],
    [new LastAdminActiveError(), HttpStatus.CONFLICT],
  ])('%p', (error, expected) => {
    expect(filter.statusOf(error)).toBe(expected);
  });
});
