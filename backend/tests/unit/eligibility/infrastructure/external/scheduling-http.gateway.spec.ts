import type { ConfigService } from '@nestjs/config';
import type { InternalHttpClient } from '@shared/infrastructure/http';
import {
  DONOR_IDS_PER_CALL,
  SchedulingHttpGateway,
} from '@src/infrastructure/external/scheduling-http.gateway';

describe('SchedulingHttpGateway (eligibility)', () => {
  const http = { send: jest.fn() };
  const config = { getOrThrow: jest.fn().mockReturnValue('http://sched') };
  const gateway = new SchedulingHttpGateway(
    http as unknown as InternalHttpClient,
    config as unknown as ConfigService,
  );

  beforeEach(() => http.send.mockReset());

  it('sem doadores, não chama o scheduling', async () => {
    expect(await gateway.donorsWithOpenAppointment([])).toEqual([]);
    expect(http.send).not.toHaveBeenCalled();
  });

  it('divide listas grandes em lotes (a rota aceita no máximo 5000) e junta as respostas', async () => {
    const ids = Array.from({ length: DONOR_IDS_PER_CALL * 2 + 1 }, (_, i) => `d${i}`);
    http.send.mockImplementation(async ({ data }: { data: { donorIds: string[] } }) => ({
      donorIds: data.donorIds.slice(0, 1),
    }));

    const open = await gateway.donorsWithOpenAppointment(ids);

    expect(http.send).toHaveBeenCalledTimes(3);
    expect(http.send).toHaveBeenNthCalledWith(1, {
      method: 'POST',
      url: 'http://sched/appointments/internal/donors-with-open-appointment',
      data: { donorIds: ids.slice(0, DONOR_IDS_PER_CALL) },
      as: 'service',
    });
    expect(open).toEqual(['d0', `d${DONOR_IDS_PER_CALL}`, `d${DONOR_IDS_PER_CALL * 2}`]);
  });
});
