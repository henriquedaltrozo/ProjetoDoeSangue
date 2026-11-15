import type { ConfigService } from '@nestjs/config';
import { Sex } from '@shared/domain/enums';
import { type InternalHttpClient, RemoteCallError } from '@shared/infrastructure/http';
import {
  ConflictError,
  DependencyUnavailableError,
  InvalidEntryError,
} from '@src/application/errors/application.errors';
import type { NewDonor } from '@src/application/ports/eligibility.gateway';
import { EligibilityHttpGateway } from '@src/infrastructure/external/eligibility-http.gateway';

describe('EligibilityHttpGateway (auth)', () => {
  const http = { send: jest.fn() };
  const config = { getOrThrow: jest.fn().mockReturnValue('http://elig') };
  const gateway = new EligibilityHttpGateway(
    http as unknown as InternalHttpClient,
    config as unknown as ConfigService,
  );
  const donor: NewDonor = {
    userId: 'u1',
    completeName: 'Maria Silva',
    cpf: '12345678901',
    birthDate: '1990-01-01',
    sex: Sex.F,
    email: 'maria@example.com',
    weightKg: 60,
    healthDataConsent: true,
  };
  const remoteFailure = (status?: number, message?: string) =>
    new RemoteCallError('POST http://elig/donors', status, message, 'falha');

  beforeEach(() => http.send.mockReset());

  it('cria o doador com a credencial interna e devolve só o id', async () => {
    http.send.mockResolvedValue({ id: 'd1', cpf: '123' });

    await expect(gateway.createDonor(donor)).resolves.toEqual({ id: 'd1' });
    expect(http.send).toHaveBeenCalledWith({
      method: 'POST',
      url: 'http://elig/donors',
      data: donor,
      as: 'service',
    });
  });

  it('traduz 409 em ConflictError com a mensagem do eligibility (ou uma padrão)', async () => {
    http.send.mockRejectedValueOnce(remoteFailure(409, 'CPF já existe.'));
    await expect(gateway.createDonor(donor)).rejects.toThrow(new ConflictError('CPF já existe.'));

    http.send.mockRejectedValueOnce(remoteFailure(409));
    await expect(gateway.createDonor(donor)).rejects.toThrow(
      new ConflictError('CPF já cadastrado.'),
    );
  });

  it('traduz 400 em InvalidEntryError com a mensagem do eligibility', async () => {
    http.send.mockRejectedValueOnce(
      remoteFailure(400, 'Informe se você já doou sangue antes dos 60 anos.'),
    );
    await expect(gateway.createDonor(donor)).rejects.toThrow(
      new InvalidEntryError('Informe se você já doou sangue antes dos 60 anos.'),
    );
  });

  it('traduz as demais falhas do cadastro em DependencyUnavailableError', async () => {
    http.send.mockRejectedValue(remoteFailure(undefined));

    await expect(gateway.createDonor(donor)).rejects.toBeInstanceOf(DependencyUnavailableError);
  });

  it('devolve null quando o doador do usuário ainda não existe (404)', async () => {
    http.send.mockRejectedValue(remoteFailure(404));

    await expect(gateway.findDonorIdByUser('u1')).resolves.toBeNull();
  });

  it('devolve o id do doador do usuário', async () => {
    http.send.mockResolvedValue({ id: 'd1' });

    await expect(gateway.findDonorIdByUser('u1')).resolves.toBe('d1');
    expect(http.send.mock.calls[0][0].url).toBe('http://elig/donors/internal/by-user/u1');
  });

  it('repassa a troca de nome/e-mail pela rota interna, com a credencial de serviço', async () => {
    http.send.mockResolvedValue({ id: 'd1' });

    await gateway.updateDonorIdentity('d1', { email: 'nova@example.com' });

    expect(http.send).toHaveBeenCalledWith({
      method: 'PATCH',
      url: 'http://elig/donors/internal/d1/identity',
      data: { email: 'nova@example.com' },
      as: 'service',
    });
  });

  it('na troca de nome/e-mail, 409 vira ConflictError e 400 vira InvalidEntryError', async () => {
    http.send.mockRejectedValueOnce(remoteFailure(409, 'conflito'));
    await expect(gateway.updateDonorIdentity('d1', { completeName: 'Nome' })).rejects.toThrow(
      new ConflictError('conflito'),
    );
    http.send.mockRejectedValueOnce(remoteFailure(400, 'E-mail inválido.'));
    await expect(gateway.updateDonorIdentity('d1', { email: 'x' })).rejects.toThrow(
      new InvalidEntryError('E-mail inválido.'),
    );
    http.send.mockRejectedValueOnce(remoteFailure(503));
    await expect(gateway.updateDonorIdentity('d1', { email: 'x' })).rejects.toBeInstanceOf(
      DependencyUnavailableError,
    );
  });

  it('traduz falha da anonimização em DependencyUnavailableError', async () => {
    http.send.mockRejectedValue(remoteFailure(500));

    await expect(gateway.anonymizeDonor('d1')).rejects.toThrow(
      new DependencyUnavailableError(
        'Não foi possível concluir a exclusão dos seus dados no momento. Tente novamente em instantes.',
      ),
    );
  });
});
