import { ConfigService } from '@nestjs/config';
import { HealthCheckService } from '@nestjs/terminus';
import { HealthController } from '@src/presentation/health/health.controller';
import { HealthOptions } from '@src/presentation/health/health.options';

function create(options: HealthOptions) {
  const health = {
    check: jest.fn(async (fns: (() => Promise<unknown>)[]) => {
      for (const fn of fns) await fn();
      return { status: 'ok' };
    }),
  };
  const db = { pingCheck: jest.fn().mockResolvedValue({}) };
  const redis = { check: jest.fn().mockResolvedValue({}) };
  const http = { pingCheck: jest.fn().mockResolvedValue({}) };
  const config = { getOrThrow: jest.fn((key: string) => `http://${key}`) };
  const controller = new HealthController(
    health as unknown as HealthCheckService,
    (options.database ? db : null) as never,
    redis as never,
    http as never,
    config as unknown as ConfigService,
    options,
  );
  return { controller, db, redis, http };
}

describe('HealthController', () => {
  it('só checa o Postgres quando é o único indicador declarado', async () => {
    const { controller, db, redis, http } = create({ database: true });
    await controller.check();
    expect(db.pingCheck).toHaveBeenCalledWith('database');
    expect(redis.check).not.toHaveBeenCalled();
    expect(http.pingCheck).not.toHaveBeenCalled();
  });

  it('checa Postgres e Redis quando ambos são declarados', async () => {
    const { controller, db, redis } = create({ database: true, redis: true });
    await controller.check();
    expect(db.pingCheck).toHaveBeenCalledWith('database');
    expect(redis.check).toHaveBeenCalledWith('redis');
  });

  it('faz ping no /health de cada serviço declarado (gateway)', async () => {
    const { controller, db, http } = create({
      services: [
        { name: 'auth-service', urlEnvVar: 'AUTH_SERVICE_URL' },
        { name: 'scheduling-service', urlEnvVar: 'SCHEDULING_SERVICE_URL' },
      ],
    });
    await controller.check();
    expect(db.pingCheck).not.toHaveBeenCalled();
    expect(http.pingCheck).toHaveBeenCalledWith('auth-service', 'http://AUTH_SERVICE_URL/health');
    expect(http.pingCheck).toHaveBeenCalledWith(
      'scheduling-service',
      'http://SCHEDULING_SERVICE_URL/health',
    );
  });
});
