import { AppLogger } from '@src/infrastructure/observability/app-logger.service';
import { RequestContextService } from '@src/infrastructure/observability/request-context.service';

describe('AppLogger', () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let logger: AppLogger;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    logger = new AppLogger('my-service');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function lastLine(spy: jest.SpyInstance): Record<string, unknown> {
    return JSON.parse(spy.mock.calls[spy.mock.calls.length - 1][0]);
  }

  it('emite uma linha JSON em console.log para log()', () => {
    logger.log('mensagem simples', 'MyContext');
    const line = lastLine(logSpy);
    expect(line).toMatchObject({
      level: 'log',
      service: 'my-service',
      message: 'mensagem simples',
      context: 'MyContext',
    });
    expect(typeof line.timestamp).toBe('string');
  });

  it('espalha os campos quando a mensagem é um objeto', () => {
    logger.log({ message: 'http_request', method: 'GET', statusCode: 200 });
    const line = lastLine(logSpy);
    expect(line).toMatchObject({ message: 'http_request', method: 'GET', statusCode: 200 });
  });

  it('inclui o requestId do RequestContextService quando disponível', () => {
    const context = new RequestContextService();
    context.run('req-xyz', () => {
      logger.log('dentro da requisição');
    });
    const line = lastLine(logSpy);
    expect(line.requestId).toBe('req-xyz');
  });

  it('requestId fica undefined fora de uma requisição', () => {
    logger.log('fora da requisição');
    const line = lastLine(logSpy);
    expect(line.requestId).toBeUndefined();
  });

  it('warn() escreve em console.warn com level warn', () => {
    logger.warn('atenção');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(lastLine(warnSpy)).toMatchObject({ level: 'warn', message: 'atenção' });
  });

  it('error() escreve em console.error com level error e inclui o stack em detail', () => {
    logger.error('falhou', 'stack-trace-aqui', 'MyContext');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const line = lastLine(errorSpy);
    expect(line).toMatchObject({ level: 'error', message: 'falhou', context: 'MyContext' });
    expect(line.detail).toEqual(['stack-trace-aqui']);
  });
});
