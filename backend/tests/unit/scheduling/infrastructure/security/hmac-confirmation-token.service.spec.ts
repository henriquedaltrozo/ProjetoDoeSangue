import { ConfigService } from '@nestjs/config';
import { InvalidEntryError, ExpiredError } from '@src/application/errors';
import { HmacConfirmationTokenService } from '@src/infrastructure/security/hmac-confirmation-token.service';

function createService(secret = 'test-secret', frontendUrl?: string) {
  const config = {
    getOrThrow: jest.fn().mockReturnValue(secret),
    get: jest.fn((_key: string, fallback: string) => frontendUrl ?? fallback),
  } as unknown as ConfigService;
  return new HmacConfirmationTokenService(config);
}

const inHours = (hours: number) => new Date(Date.now() + hours * 3_600_000);

describe('HmacConfirmationTokenService', () => {
  it('gera um token que volta o id do agendamento ao ser verificado', () => {
    const service = createService();
    const token = service.generate('appointment-1', inHours(30));

    expect(service.verify(token)).toBe('appointment-1');
  });

  it('rejeita um token com a assinatura adulterada', () => {
    const service = createService();
    const [body, signature] = service.generate('appointment-1', inHours(30)).split('.');
    const tampered = `${signature.slice(0, -2)}${signature.endsWith('AA') ? 'BB' : 'AA'}`;

    expect(() => service.verify(`${body}.${tampered}`)).toThrow(InvalidEntryError);
  });

  it('rejeita um token cujo corpo foi trocado para outro agendamento', () => {
    const service = createService();
    const [, signature] = service.generate('appointment-1', inHours(30)).split('.');
    const [otherBody] = service.generate('appointment-2', inHours(30)).split('.');

    expect(() => service.verify(`${otherBody}.${signature}`)).toThrow(InvalidEntryError);
  });

  it('rejeita um token assinado com outro segredo', () => {
    const token = createService('secret-a').generate('appointment-1', inHours(30));

    expect(() => createService('secret-b').verify(token)).toThrow(InvalidEntryError);
  });

  it.each(['', 'without-ponto', 'a.b.c', '.', 'abc.'])(
    'rejeita o token malformado "%s"',
    (token) => {
      expect(() => createService().verify(token)).toThrow(
        new InvalidEntryError('Link de confirmação inválido.'),
      );
    },
  );

  it('lança ExpiredError para um token válido que já passou do horário do agendamento', () => {
    const service = createService();
    const token = service.generate('appointment-1', inHours(-1));

    expect(() => service.verify(token)).toThrow(
      new ExpiredError('Este link de confirmação expirou.'),
    );
  });

  it('monta a URL do front sem barra duplicada e com o token na query', () => {
    const service = createService('test-secret', 'https://donations.example.com/');
    const url = service.buildUrl('appointment-1', inHours(30));

    expect(url.startsWith('https://donations.example.com/confirm-attendance?token=')).toBe(true);
    const token = url.split('token=')[1];
    expect(service.verify(token)).toBe('appointment-1');
  });

  it('usa o front local como padrão quando FRONTEND_URL não está definida', () => {
    const url = createService().buildUrl('appointment-1', inHours(30));

    expect(url.startsWith('http://localhost:5173/confirm-attendance?token=')).toBe(true);
  });
});
