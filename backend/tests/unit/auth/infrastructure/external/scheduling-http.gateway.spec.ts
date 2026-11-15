import type { ConfigService } from '@nestjs/config';
import { type InternalHttpClient, RemoteCallError } from '@shared/infrastructure/http';
import { DependencyUnavailableError } from '@src/application/errors/application.errors';
import { SchedulingHttpGateway } from '@src/infrastructure/external/scheduling-http.gateway';

describe('SchedulingHttpGateway (auth)', () => {
  const http = { send: jest.fn() };
  const config = { getOrThrow: jest.fn().mockReturnValue('http://sched') };
  const gateway = new SchedulingHttpGateway(
    http as unknown as InternalHttpClient,
    config as unknown as ConfigService,
  );

  beforeEach(() => http.send.mockReset());

  it('cancela os agendamentos em aberto do doador com a credencial interna', async () => {
    http.send.mockResolvedValue({ canceled: 2 });

    await gateway.cancelOpenAppointments('d1');

    expect(http.send).toHaveBeenCalledWith({
      method: 'POST',
      url: 'http://sched/appointments/internal/donors/d1/cancel-open',
      as: 'service',
    });
  });

  it('traduz falha do scheduling em DependencyUnavailableError', async () => {
    http.send.mockRejectedValue(new RemoteCallError('POST x', 500, undefined, 'falha'));

    await expect(gateway.cancelOpenAppointments('d1')).rejects.toBeInstanceOf(
      DependencyUnavailableError,
    );
  });
});
