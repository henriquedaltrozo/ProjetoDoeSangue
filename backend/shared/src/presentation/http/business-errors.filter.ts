import { STATUS_CODES } from 'node:http';
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import {
  AccessDeniedError,
  ApplicationError,
  ConflictError,
  DependencyUnavailableError,
  InvalidEntryError,
  NotFoundError,
} from '../../application/errors';
import { BusinessRuleError, DomainError, InvalidValueError } from '../../domain/errors';

type ErrorClass = abstract new (...args: never[]) => ApplicationError | DomainError;

/** Pares [classe de erro, status HTTP]; o primeiro que casar (instanceof) vence. */
export type ErrorStatusMapping = ReadonlyArray<readonly [ErrorClass, HttpStatus]>;

/** Status dos erros comuns (shared); cada serviço acrescenta os seus. */
export const COMMON_ERROR_STATUS: ErrorStatusMapping = [
  [NotFoundError, HttpStatus.NOT_FOUND],
  [AccessDeniedError, HttpStatus.FORBIDDEN],
  [ConflictError, HttpStatus.CONFLICT],
  [DependencyUnavailableError, HttpStatus.BAD_GATEWAY],
  [InvalidEntryError, HttpStatus.BAD_REQUEST],
  [BusinessRuleError, HttpStatus.CONFLICT],
  [InvalidValueError, HttpStatus.BAD_REQUEST],
];

/**
 * Traduz erros de aplicação e de domínio em resposta HTTP, no mesmo formato das HttpExceptions do
 * Nest (`{ statusCode, message, error }`). Um erro sem status mapeado vira 500 sem expor a mensagem.
 * Registrar com `{ provide: APP_FILTER, useValue: new BusinessErrorsFilter([...específicos]) }`.
 */
@Catch(ApplicationError, DomainError)
export class BusinessErrorsFilter implements ExceptionFilter<ApplicationError | DomainError> {
  private readonly mapping: ErrorStatusMapping;

  constructor(serviceMapping: ErrorStatusMapping = []) {
    // Os específicos do serviço vêm antes: podem refinar uma classe comum.
    this.mapping = [...serviceMapping, ...COMMON_ERROR_STATUS];
  }

  statusOf(error: ApplicationError | DomainError): HttpStatus {
    return (
      this.mapping.find(([type]) => error instanceof type)?.[1] ?? HttpStatus.INTERNAL_SERVER_ERROR
    );
  }

  catch(error: ApplicationError | DomainError, host: ArgumentsHost): void {
    const statusCode = this.statusOf(error);
    const body =
      statusCode === HttpStatus.INTERNAL_SERVER_ERROR
        ? { statusCode, message: 'Internal server error' }
        : { statusCode, message: error.message, error: STATUS_CODES[statusCode] };
    host.switchToHttp().getResponse<Response>().status(statusCode).json(body);
  }
}
