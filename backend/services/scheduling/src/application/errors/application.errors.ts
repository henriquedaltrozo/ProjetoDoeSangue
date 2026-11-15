import { ApplicationError } from '@shared/application/errors';

export {
  AccessDeniedError,
  ApplicationError,
  ConflictError,
  DependencyUnavailableError,
  InvalidEntryError,
  NotFoundError,
} from '@shared/application/errors';

/** O recurso existiu, mas não vale mais (ex.: link de confirmação expirado). */
export class ExpiredError extends ApplicationError {}

/** O evento do outbox tem um tipo sem handler registrado. */
export class UnknownEventTypeError extends ApplicationError {
  constructor(type: string) {
    super(`Tipo de evento desconhecido: ${type}`);
  }
}
