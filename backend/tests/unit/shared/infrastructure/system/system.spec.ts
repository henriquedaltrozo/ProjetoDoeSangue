import { NestLoggerAdapter } from '@src/infrastructure/logging/nest-logger.adapter';
import { SystemClock } from '@src/infrastructure/system/system-clock';

describe('SystemClock', () => {
  it('devolve o instante atual', () => {
    const before = Date.now();
    const now = new SystemClock().now().getTime();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });
});

describe('NestLoggerAdapter', () => {
  it('não lança ao registrar warn e error com e sem contexto', () => {
    const logger = new NestLoggerAdapter('Teste');
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    expect(() => logger.warn('aviso')).not.toThrow();
    expect(() => logger.error('falha', 'Outro', 'stack')).not.toThrow();
    jest.restoreAllMocks();
  });
});
