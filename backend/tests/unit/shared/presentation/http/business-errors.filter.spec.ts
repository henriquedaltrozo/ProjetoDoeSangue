import { HttpStatus } from '@nestjs/common';
import {
  AccessDeniedError,
  ApplicationError,
  ConflictError,
  DependencyUnavailableError,
  NotFoundError,
} from '@src/application/errors';
import { BusinessRuleError, InvalidValueError } from '@src/domain/errors';
import { BusinessErrorsFilter } from '@src/presentation/http/business-errors.filter';

class TeapotError extends ApplicationError {}
class UnmappedError extends ApplicationError {}

function respond(filter: BusinessErrorsFilter, error: Error) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = { switchToHttp: () => ({ getResponse: () => ({ status }) }) };
  filter.catch(error as never, host as never);
  return { status: status.mock.calls[0][0], body: json.mock.calls[0][0] };
}

describe('BusinessErrorsFilter', () => {
  it.each([
    [new NotFoundError('x'), HttpStatus.NOT_FOUND],
    [new AccessDeniedError('x'), HttpStatus.FORBIDDEN],
    [new ConflictError('x'), HttpStatus.CONFLICT],
    [new DependencyUnavailableError('x'), HttpStatus.BAD_GATEWAY],
    [new BusinessRuleError('x'), HttpStatus.CONFLICT],
    [new InvalidValueError('x'), HttpStatus.BAD_REQUEST],
  ])('traduz %p nos erros comuns', (error, expected) => {
    expect(new BusinessErrorsFilter().statusOf(error)).toBe(expected);
  });

  it('responde no formato das HttpExceptions do Nest', () => {
    expect(
      respond(new BusinessErrorsFilter(), new NotFoundError('Doador não encontrado.')),
    ).toEqual({
      status: 404,
      body: { statusCode: 404, message: 'Doador não encontrado.', error: 'Not Found' },
    });
  });

  it('aceita os status específicos de um serviço', () => {
    const filter = new BusinessErrorsFilter([[TeapotError, HttpStatus.I_AM_A_TEAPOT]]);
    expect(filter.statusOf(new TeapotError('x'))).toBe(HttpStatus.I_AM_A_TEAPOT);
  });

  it('erro sem status mapeado vira 500 sem expor a mensagem', () => {
    expect(respond(new BusinessErrorsFilter(), new UnmappedError('detalhe interno'))).toEqual({
      status: 500,
      body: { statusCode: 500, message: 'Internal server error' },
    });
  });
});
