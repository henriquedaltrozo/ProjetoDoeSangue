import type { ConfigService } from '@nestjs/config';
import { BloodType } from '@shared/domain/enums';
import { type InternalHttpClient, RemoteCallError } from '@shared/infrastructure/http';
import { DependencyUnavailableError } from '@src/application/errors';
import { EligibilityHttpGateway } from '@src/infrastructure/external/eligibility-http.gateway';

describe('EligibilityHttpGateway (scheduling)', () => {
  const http = { send: jest.fn() };
  const config = { getOrThrow: jest.fn().mockReturnValue('http://elig') };
  const gateway = new EligibilityHttpGateway(
    http as unknown as InternalHttpClient,
    config as unknown as ConfigService,
  );

  beforeEach(() => http.send.mockReset());

  it('avalia pela rota interna, com a credencial do serviço', async () => {
    http.send.mockResolvedValue({ id: 'a' });

    await expect(gateway.assessInternal({ donorId: 'd' } as never)).resolves.toEqual({
      id: 'a',
    });
    expect(http.send).toHaveBeenCalledWith({
      method: 'POST',
      url: 'http://elig/eligibility/internal/assess',
      data: { donorId: 'd' },
      as: 'service',
    });
  });

  it('registra a doação concluída com a credencial interna', async () => {
    http.send.mockResolvedValue({ id: 'd' });

    await gateway.completeDonation('d', '2026-09-10');

    expect(http.send).toHaveBeenCalledWith({
      method: 'POST',
      url: 'http://elig/donors/d/donations/complete',
      data: { donationDate: '2026-09-10' },
      as: 'service',
    });
  });

  it('filtra contatos por tipo sanguíneo só quando informado', async () => {
    http.send.mockResolvedValue([]);

    await gateway.listContactsByBloodType(BloodType.O_NEGATIVE);
    await gateway.listContactsByBloodType();

    expect(http.send.mock.calls[0][0].params).toEqual({ bloodType: BloodType.O_NEGATIVE });
    expect(http.send.mock.calls[1][0].params).toBeUndefined();
  });

  it('traduz falha do serviço remoto em DependencyUnavailableError', async () => {
    http.send.mockRejectedValue(
      new RemoteCallError('GET http://elig/donors/d', 500, undefined, 'x'),
    );

    await expect(gateway.completeDonation('d')).rejects.toThrow(
      new DependencyUnavailableError(
        'Não foi possível concluir a operação com o serviço de elegibilidade (registrar doação concluída).',
      ),
    );
  });

  it('deixa passar erros que não vieram do serviço remoto', async () => {
    const error = new Error('bug');
    http.send.mockRejectedValue(error);

    await expect(gateway.assessInternal({} as never)).rejects.toBe(error);
  });
});
