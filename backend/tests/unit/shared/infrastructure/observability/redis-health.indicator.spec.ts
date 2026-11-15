import { ConfigService } from '@nestjs/config';
import { HealthCheckError } from '@nestjs/terminus';
import { RedisHealthIndicator } from '@src/infrastructure/observability/redis-health.indicator';

const connectMock = jest.fn();
const pingMock = jest.fn();
const disconnectMock = jest.fn();

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    connect: connectMock,
    ping: pingMock,
    disconnect: disconnectMock,
  })),
}));

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator;
  let config: ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    config = { get: jest.fn(() => undefined) } as unknown as ConfigService;
    indicator = new RedisHealthIndicator(config);
  });

  it('retorna status up quando o PING responde PONG', async () => {
    connectMock.mockResolvedValue(undefined);
    pingMock.mockResolvedValue('PONG');

    const result = await indicator.check('redis');

    expect(result.redis.status).toBe('up');
    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });

  it('lança HealthCheckError quando o PING não responde PONG', async () => {
    connectMock.mockResolvedValue(undefined);
    pingMock.mockResolvedValue('ALGO_INESPERADO');

    await expect(indicator.check('redis')).rejects.toBeInstanceOf(HealthCheckError);
    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });

  it('lança HealthCheckError quando a conexão falha', async () => {
    connectMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(indicator.check('redis')).rejects.toBeInstanceOf(HealthCheckError);
    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });
});
