import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { NodemailerMailSender, isTestInbox } from '@src/infrastructure/mail/nodemailer-mail-sender';

const sendMailMock = jest.fn();
const verifyMock = jest.fn();
const createTransportMock = jest.fn((..._args: unknown[]) => ({
  sendMail: sendMailMock,
  verify: verifyMock,
}));

jest.mock('nodemailer', () => ({
  __esModule: true,
  createTransport: (...args: unknown[]) => createTransportMock(...args),
}));

function configAsMap(values: Record<string, unknown>): ConfigService {
  return {
    get: jest.fn((key: string, fallback?: unknown) => values[key] ?? fallback),
  } as unknown as ConfigService;
}

describe('NodemailerMailSender', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ao subir', () => {
    let error: jest.SpyInstance;
    let warn: jest.SpyInstance;
    beforeEach(() => {
      error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    });
    afterEach(() => jest.restoreAllMocks());

    it('confere a conexão SMTP e registra o erro, com o que conferir, se falhar', async () => {
      verifyMock.mockRejectedValueOnce(new Error('Invalid login'));
      const service = new NodemailerMailSender(configAsMap({ SMTP_HOST: 'smtp.exemplo.com' }));

      await service.onApplicationBootstrap();

      expect(verifyMock).toHaveBeenCalled();
      expect(error).toHaveBeenCalledWith(expect.stringContaining('Invalid login'));
      expect(error).toHaveBeenCalledWith(expect.stringContaining('SMTP_PASSWORD'));
    });

    it('em produção, avisa quando os e-mails vão para a caixa de teste ou estão simulados', async () => {
      await new NodemailerMailSender(
        configAsMap({ SMTP_HOST: 'mailpit', NODE_ENV: 'production' }),
      ).onApplicationBootstrap();
      await new NodemailerMailSender(
        configAsMap({ NODE_ENV: 'production' }),
      ).onApplicationBootstrap();

      expect(warn).toHaveBeenCalledTimes(2);
      expect(warn.mock.calls[0][0]).toContain('caixa de teste');
    });

    it('fora de produção, o Mailpit não gera aviso', async () => {
      await new NodemailerMailSender(
        configAsMap({ SMTP_HOST: 'mailpit' }),
      ).onApplicationBootstrap();

      expect(warn).not.toHaveBeenCalled();
      expect(isTestInbox('smtp-relay.brevo.com')).toBe(false);
    });
  });

  describe('sem SMTP_HOST configurado (modo simulado - padrão em dev/CI)', () => {
    it('não cria transporte e não lança ao "enviar"', async () => {
      const service = new NodemailerMailSender(configAsMap({}));

      expect(service.enabled).toBe(false);
      expect(createTransportMock).not.toHaveBeenCalled();

      await expect(
        service.send({ to: 'donor@example.com', subject: 'Oi', text: 'Corpo' }),
      ).resolves.toBeUndefined();
      expect(sendMailMock).not.toHaveBeenCalled();
    });
  });

  describe('com SMTP_HOST configurado', () => {
    it('cria o transporte com host/porta/secure/auth corretos', () => {
      const service = new NodemailerMailSender(
        configAsMap({
          SMTP_HOST: 'smtp.exemplo.com',
          SMTP_PORT: 465,
          SMTP_SECURE: 'true',
          SMTP_USER: 'user',
          SMTP_PASSWORD: 'secret',
        }),
      );

      expect(service.enabled).toBe(true);
      expect(createTransportMock).toHaveBeenCalledWith({
        host: 'smtp.exemplo.com',
        port: 465,
        secure: true,
        auth: { user: 'user', pass: 'secret' },
      });
    });

    it('trata SMTP_SECURE=false (string) como não-seguro, não como truthy', () => {
      const service = new NodemailerMailSender(
        configAsMap({ SMTP_HOST: 'smtp.exemplo.com', SMTP_SECURE: 'false' }),
      );
      expect(service.enabled).toBe(true);
      expect(createTransportMock).toHaveBeenCalledWith(expect.objectContaining({ secure: false }));
    });

    it('omite auth quando SMTP_USER não está definido', () => {
      new NodemailerMailSender(configAsMap({ SMTP_HOST: 'smtp.exemplo.com' }));
      expect(createTransportMock).toHaveBeenCalledWith(
        expect.objectContaining({ auth: undefined }),
      );
    });

    it('chama sendMail com o remetente configurado', async () => {
      sendMailMock.mockResolvedValue(undefined);
      const service = new NodemailerMailSender(
        configAsMap({ SMTP_HOST: 'smtp.exemplo.com', MAIL_FROM: 'contact@donations.org' }),
      );

      await service.send({ to: 'donor@example.com', subject: 'Oi', text: 'Corpo' });

      expect(sendMailMock).toHaveBeenCalledWith({
        from: 'contact@donations.org',
        to: 'donor@example.com',
        subject: 'Oi',
        text: 'Corpo',
        headers: { 'Content-Language': 'pt-BR' },
      });
    });

    it('envia a versão HTML junto com o texto', async () => {
      const service = new NodemailerMailSender(configAsMap({ SMTP_HOST: 'smtp.exemplo.com' }));

      await service.send({
        to: 'd@example.com',
        subject: 'Oi',
        text: 'Corpo',
        html: '<p>Corpo</p>',
      });

      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Corpo', html: '<p>Corpo</p>' }),
      );
    });

    it('propaga o erro quando o envio falha', async () => {
      sendMailMock.mockRejectedValue(new Error('conexão recusada'));
      const service = new NodemailerMailSender(configAsMap({ SMTP_HOST: 'smtp.exemplo.com' }));

      await expect(
        service.send({ to: 'donor@example.com', subject: 'Oi', text: 'Corpo' }),
      ).rejects.toThrow('conexão recusada');
    });
  });
});
