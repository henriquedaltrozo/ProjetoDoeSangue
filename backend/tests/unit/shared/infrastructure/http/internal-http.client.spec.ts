import type { HttpService } from '@nestjs/axios';
import type { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { InternalHttpClient } from '@src/infrastructure/http/internal-http.client';
import { RemoteCallError } from '@src/infrastructure/http/remote-call.error';
import { RequestContextService } from '@src/infrastructure/observability/request-context.service';

describe('InternalHttpClient', () => {
  const http = { request: jest.fn() };
  const config = { getOrThrow: jest.fn().mockReturnValue('chave-interna') };
  const requestContext = new RequestContextService();
  const client = new InternalHttpClient(
    http as unknown as HttpService,
    config as unknown as ConfigService,
    requestContext,
  );

  beforeEach(() => http.request.mockReset());

  it('chama em nome do serviço com a x-internal-api-key e devolve o corpo da resposta', async () => {
    http.request.mockReturnValue(of({ data: { id: 'd1' } }));

    await expect(
      client.send({ method: 'POST', url: 'http://elig/donors', data: { a: 1 }, as: 'service' }),
    ).resolves.toEqual({ id: 'd1' });

    expect(http.request).toHaveBeenCalledWith({
      method: 'POST',
      url: 'http://elig/donors',
      data: { a: 1 },
      params: undefined,
      headers: { 'x-internal-api-key': 'chave-interna' },
    });
  });

  it('em nome do usuário, repassa o Authorization e o x-request-id da requisição atual', async () => {
    http.request.mockReturnValue(of({ data: [] }));

    await requestContext.run(
      'req-42',
      () => client.send({ method: 'GET', url: 'http://elig/donors/1', as: 'user' }),
      { authorization: 'Bearer abc' },
    );

    expect(http.request.mock.calls[0][0].headers).toEqual({
      Authorization: 'Bearer abc',
      'x-request-id': 'req-42',
    });
  });

  it('em nome do usuário fora de uma requisição autenticada, falha sem chamar o serviço remoto', async () => {
    const error = await requestContext
      .run('req-1', () => client.send({ method: 'GET', url: 'http://elig/x', as: 'user' }))
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(RemoteCallError);
    expect(http.request).not.toHaveBeenCalled();
  });

  it('converte a falha em RemoteCallError com status e mensagem do serviço remoto', async () => {
    http.request.mockReturnValue(
      throwError(() => ({
        message: 'Request failed with status code 409',
        response: { status: 409, data: { message: ['CPF inválido', 'e-mail inválido'] } },
      })),
    );

    const error = await client
      .send({ method: 'POST', url: 'http://elig/donors', as: 'service' })
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(RemoteCallError);
    expect(error).toMatchObject({
      call: 'POST http://elig/donors',
      status: 409,
      remoteMessage: 'CPF inválido; e-mail inválido',
    });
  });

  it('usa status indefinido quando não houve resposta (timeout, conexão recusada)', async () => {
    http.request.mockReturnValue(throwError(() => ({ message: 'timeout of 5000ms exceeded' })));

    await expect(
      client.send({ method: 'GET', url: 'http://elig/x', as: 'service' }),
    ).rejects.toMatchObject({ status: undefined, remoteMessage: undefined });
  });
});
