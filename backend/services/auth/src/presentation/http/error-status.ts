import { HttpStatus } from '@nestjs/common';
import type { ErrorStatusMapping } from '@shared/presentation/http';
import { ManyAttemptsError, NotAuthenticatedError } from '../../application/errors';

/** Status HTTP dos erros específicos do auth (os comuns já estão no BusinessErrorsFilter). */
export const AUTH_ERROR_STATUS: ErrorStatusMapping = [
  [NotAuthenticatedError, HttpStatus.UNAUTHORIZED],
  [ManyAttemptsError, HttpStatus.TOO_MANY_REQUESTS],
];
