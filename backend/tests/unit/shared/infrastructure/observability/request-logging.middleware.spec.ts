import { EventEmitter } from 'node:events';
import {
  createRequestLoggingMiddleware,
  REQUEST_ID_HEADER,
} from '@src/infrastructure/observability/request-logging.middleware';
import { RequestContextService } from '@src/infrastructure/observability/request-context.service';

function createRequest(headers: Record<string, string> = {}) {
  return { headers, method: 'GET', originalUrl: '/route/test' } as any;
}

function createResponse() {
  const emitter = new EventEmitter() as any;
  emitter.statusCode = 200;
  emitter.setHeader = jest.fn();
  return emitter;
}

describe('createRequestLoggingMiddleware', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('gera um novo requestId quando nenhum header foi enviado', () => {
    const middleware = createRequestLoggingMiddleware('test-service');
    const req = createRequest();
    const res = createResponse();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.headers[REQUEST_ID_HEADER]).toEqual(expect.any(String));
    expect(res.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, req.headers[REQUEST_ID_HEADER]);
  });

  it('reaproveita o requestId recebido no header de entrada', () => {
    const middleware = createRequestLoggingMiddleware('test-service');
    const req = createRequest({ [REQUEST_ID_HEADER]: 'id-existing' });
    const res = createResponse();
    const next = jest.fn();

    middleware(req, res, next);

    expect(req.headers[REQUEST_ID_HEADER]).toBe('id-existing');
    expect(res.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, 'id-existing');
  });

  it.each(['a'.repeat(129), 'id com espaço', 'id\ncom-quebra'])(
    'troca um requestId fora do formato (%j) por um novo',
    (invalid) => {
      const middleware = createRequestLoggingMiddleware('test-service');
      const req = createRequest({ [REQUEST_ID_HEADER]: invalid });

      middleware(req, createResponse(), jest.fn());

      expect(req.headers[REQUEST_ID_HEADER]).not.toBe(invalid);
      expect(req.headers[REQUEST_ID_HEADER]).toMatch(/^[0-9a-f-]{36}$/);
    },
  );

  it('disponibiliza o requestId via RequestContextService durante next()', () => {
    const context = new RequestContextService();
    const middleware = createRequestLoggingMiddleware('test-service');
    const req = createRequest({ [REQUEST_ID_HEADER]: 'id-propagado' });
    const res = createResponse();
    let captured: string | undefined;

    middleware(req, res, () => {
      captured = context.getRequestId();
    });

    expect(captured).toBe('id-propagado');
  });

  it('guarda o header Authorization no contexto, para repassá-lo em chamadas internas', () => {
    const context = new RequestContextService();
    const middleware = createRequestLoggingMiddleware('test-service');
    const req = createRequest({ authorization: 'Bearer abc' });
    const res = createResponse();
    let captured: string | undefined;

    middleware(req, res, () => {
      captured = context.getAuthorization();
    });

    expect(captured).toBe('Bearer abc');
  });

  it('loga um evento estruturado quando a resposta termina (finish)', () => {
    const middleware = createRequestLoggingMiddleware('test-service');
    const req = createRequest({ [REQUEST_ID_HEADER]: 'id-log' });
    const res = createResponse();
    res.statusCode = 201;

    middleware(req, res, () => {
      res.emit('finish');
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = JSON.parse(logSpy.mock.calls[0][0]);
    expect(line).toMatchObject({
      service: 'test-service',
      requestId: 'id-log',
      message: 'http_request',
      method: 'GET',
      path: '/route/test',
      statusCode: 201,
    });
    expect(typeof line.durationMs).toBe('number');
  });
});
