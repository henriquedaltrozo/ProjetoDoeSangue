import { HttpStatus } from '@nestjs/common';
import type { ErrorStatusMapping } from '@shared/presentation/http';
import { ExpiredError } from '../../application/errors';

/** Status HTTP dos erros específicos do scheduling (os comuns já estão no BusinessErrorsFilter). */
export const SCHEDULING_ERROR_STATUS: ErrorStatusMapping = [[ExpiredError, HttpStatus.GONE]];
