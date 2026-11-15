import { ApplicationError } from '@shared/application/errors';

export {
  AccessDeniedError,
  ApplicationError,
  ConflictError,
  DependencyUnavailableError,
  InvalidEntryError,
  NotFoundError,
} from '@shared/application/errors';

/** Credenciais/sessão/token ausentes, inválidos ou expirados. */
export class NotAuthenticatedError extends ApplicationError {
  constructor(message = 'Unauthorized') {
    super(message);
  }
}

/** Limite de tentativas excedido (ex.: conta bloqueada temporariamente por força bruta). */
export class ManyAttemptsError extends ApplicationError {}
