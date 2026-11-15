import { NotificationJobType } from '@shared/domain/enums';
import { NotificationStatus } from '@src/domain/enums';
import { NotificationLog } from '@src/domain/entities/notification-log';
import { EmailNotifier } from '@src/application/services/email-notifier';
import { DispatchNotificationUseCase } from '@src/application/use-cases/dispatch-notification.use-case';
import { NotificationDeliveryError } from '@src/application/errors';

describe('DispatchNotificationUseCase', () => {
  let mail: { send: jest.Mock };
  let saved: NotificationLog[];
  let dispatch: DispatchNotificationUseCase;

  beforeEach(() => {
    saved = [];
    mail = { send: jest.fn().mockResolvedValue(undefined) };
    dispatch = new DispatchNotificationUseCase(
      new EmailNotifier(
        mail,
        {
          save: jest.fn(async (l: NotificationLog) => void saved.push(l)),
          erasePersonalData: jest.fn(),
          purgeOlderThan: jest.fn(),
          listPage: jest.fn(),
          isErased: jest.fn().mockResolvedValue(false),
          wasSent: jest.fn(async (jobId: string, recipient: string) =>
            saved.some(
              (l) =>
                l.jobId === jobId &&
                l.recipient === recipient &&
                l.status === NotificationStatus.SENT,
            ),
          ),
        },
        { warn: jest.fn(), error: jest.fn() },
        {
          reasonFor: jest.fn().mockResolvedValue(null),
          add: jest.fn(),
          remove: jest.fn(),
          list: jest.fn(),
        },
      ),
      { frontendUrl: 'http://front.test' },
      {
        forDonor: (donorId: string) => ({
          pageUrl: `http://front.test/unsubscribe?token=${donorId}`,
          oneClickUrl: `http://api.test/donors/alerts/unsubscribe?token=${donorId}`,
        }),
      },
    );
  });

  const base = {
    appointmentId: 'appointment-1',
    donorId: 'donor-1',
    donorName: 'Fulano',
    recipientEmail: 'fulano@example.com',
    // 13:00 UTC = 10:00 em Brasília: o e-mail precisa mostrar o horário do doador, não o do servidor.
    dateTime: '2026-10-10T13:00:00.000Z',
    collectionUnitName: 'Unidade Central',
  };
  const url = 'http://localhost:5173/confirm-attendance?token=abc.def';

  describe('lembrete de 24 h', () => {
    it('persiste um log SENT para o lembrete de 24h', async () => {
      await dispatch.execute({ type: NotificationJobType.REMINDER_24H, ...base }, 'job-1');

      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({
        donorId: 'donor-1',
        type: NotificationJobType.REMINDER_24H,
        status: NotificationStatus.SENT,
        recipient: 'fulano@example.com',
        jobId: 'job-1',
      });
    });

    it('inclui o link de confirmação enquanto o doador não confirmou', async () => {
      await dispatch.execute(
        { type: NotificationJobType.REMINDER_24H, ...base, confirmationUrl: url },
        'job-1',
      );

      const { text } = mail.send.mock.calls[0][0];
      expect(text).toContain(url);
      expect(text).toContain('Unidade Central');
    });

    it.each([null, undefined])('vira só lembrete quando confirmationUrl é %s', async (value) => {
      await dispatch.execute(
        { type: NotificationJobType.REMINDER_24H, ...base, confirmationUrl: value },
        'job-1',
      );

      const { text } = mail.send.mock.calls[0][0];
      expect(text).not.toContain('confirm-attendance');
      expect(text).not.toContain('Ainda não confirmou');
    });

    it('mostra o horário no fuso de Brasília, independente do fuso do servidor', async () => {
      await dispatch.execute({ type: NotificationJobType.REMINDER_24H, ...base }, 'job-1');

      expect(mail.send.mock.calls[0][0].text).toMatch(/10\/10\/2026.*10:00/);
    });

    it('persiste FAILURE e pede nova tentativa ao BullMQ quando o envio de e-mail rejeita', async () => {
      mail.send.mockRejectedValueOnce(new Error('conexão recusada'));

      await expect(
        dispatch.execute({ type: NotificationJobType.REMINDER_24H, ...base }, 'job-4'),
      ).rejects.toBeInstanceOf(NotificationDeliveryError);

      expect(saved[0]).toMatchObject({
        status: NotificationStatus.FAILURE,
        error: 'conexão recusada',
      });
    });
  });

  it('confirmação de presença: envia o pedido com o link e grava um log SENT', async () => {
    await dispatch.execute(
      { type: NotificationJobType.ATTENDANCE_CONFIRMATION, ...base, confirmationUrl: url },
      'job-2',
    );

    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'fulano@example.com',
        subject: 'Confirme sua presença na doação de sangue',
        text: expect.stringContaining(url),
      }),
    );
    expect(saved[0]).toMatchObject({
      donorId: 'donor-1',
      type: NotificationJobType.ATTENDANCE_CONFIRMATION,
      status: NotificationStatus.SENT,
      jobId: 'job-2',
    });
  });

  it('intervalo concluído: envia o agradecimento e grava o log', async () => {
    await dispatch.execute(
      {
        type: NotificationJobType.INTERVAL_COMPLETED,
        donorId: 'donor-1',
        donorName: 'Fulano',
        recipientEmail: 'fulano@example.com',
        nextEligibilityDate: '2026-12-01',
      },
      'job-5',
    );

    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Obrigado por doar!' }),
    );
    expect(saved[0]).toMatchObject({
      donorId: 'donor-1',
      type: NotificationJobType.INTERVAL_COMPLETED,
      status: NotificationStatus.SENT,
    });
  });

  it('campanha urgente: envia uma notificação por destinatário', async () => {
    await dispatch.execute(
      {
        type: NotificationJobType.URGENT_CAMPAIGN,
        campaignId: 'campaign-1',
        title: 'Precisamos de doadores O-',
        message: 'Estoque crítico de O negativo.',
        recipients: [
          { donorId: 'd1', donorName: 'Ana', recipientEmail: 'ana@example.com' },
          { donorId: 'd2', donorName: 'Beto', recipientEmail: 'beto@example.com' },
        ],
      },
      'job-2',
    );

    expect(saved).toHaveLength(2);
    expect(saved.map((l) => l.donorId)).toEqual(['d1', 'd2']);
    expect(mail.send.mock.calls[1][0]).toEqual({
      to: 'beto@example.com',
      subject: 'Campanha urgente: Precisamos de doadores O-',
      text: expect.stringContaining('Olá, Beto!\n\nEstoque crítico de O negativo.'),
      html: expect.stringContaining('Estoque crítico de O negativo.'),
      // Cada doador recebe o próprio link de descadastro.
      headers: expect.objectContaining({
        'List-Unsubscribe': '<http://api.test/donors/alerts/unsubscribe?token=d2>',
      }),
    });
  });

  it('campanha urgente: na nova tentativa, só reenvia a quem não recebeu', async () => {
    const campaign = {
      type: NotificationJobType.URGENT_CAMPAIGN as const,
      campaignId: 'campaign-1',
      title: 'Precisamos de doadores O-',
      message: 'Estoque crítico de O negativo.',
      recipients: [
        { donorId: 'd1', donorName: 'Ana', recipientEmail: 'ana@example.com' },
        { donorId: 'd2', donorName: 'Beto', recipientEmail: 'beto@example.com' },
      ],
    };
    mail.send.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('SMTP fora'));

    await expect(dispatch.execute(campaign, 'job-7')).rejects.toBeInstanceOf(
      NotificationDeliveryError,
    );
    await dispatch.execute(campaign, 'job-7');

    const sentTo = mail.send.mock.calls.map((call) => call[0].to);
    expect(sentTo).toEqual(['ana@example.com', 'beto@example.com', 'beto@example.com']);
  });

  it('envia texto e HTML juntos', async () => {
    await dispatch.execute({ type: NotificationJobType.REMINDER_24H, ...base }, 'job-1');

    expect(mail.send.mock.calls[0][0].html).toContain('<!doctype html>');
  });

  it.each([
    [{ type: NotificationJobType.APPOINTMENT_BOOKED as const, ...base }, 'Agendamento confirmado'],
    [
      {
        type: NotificationJobType.APPOINTMENT_CANCELED as const,
        ...base,
        reason: 'Unidade de coleta desativada.',
        canceledByStaff: true,
      },
      'Agendamento cancelado',
    ],
    [
      {
        type: NotificationJobType.ELIGIBLE_AGAIN as const,
        donorId: 'donor-1',
        donorName: 'Fulano',
        recipientEmail: 'fulano@example.com',
        eligibleSince: '2026-12-01',
      },
      'Você já pode doar sangue novamente',
    ],
  ])('avisos do doador (%#): grava o log com o donorId', async (payload, subject) => {
    await dispatch.execute(payload, 'job-9');

    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'fulano@example.com',
        subject: expect.stringContaining(subject),
      }),
    );
    expect(saved[0]).toMatchObject({ donorId: 'donor-1', userId: null, type: payload.type });
  });

  it('boas-vindas e aviso de falta: montam o e-mail e gravam o log', async () => {
    await dispatch.execute(
      {
        type: NotificationJobType.WELCOME,
        userId: 'user-1',
        donorId: 'donor-1',
        name: 'Ana',
        recipientEmail: 'ana@example.com',
      },
      'job-w',
    );
    await dispatch.execute({ type: NotificationJobType.NO_SHOW, ...base }, 'job-n');

    expect(mail.send.mock.calls.map((c) => c[0].subject)).toEqual([
      'Boas-vindas ao DoeSangue',
      'Sentimos sua falta na doação de 10/10/2026 às 10:00',
    ]);
    expect(saved[0]).toMatchObject({ userId: 'user-1', donorId: 'donor-1' });
    expect(saved[1]).toMatchObject({ donorId: 'donor-1', type: NotificationJobType.NO_SHOW });
  });

  it.each([
    {
      type: NotificationJobType.PASSWORD_CHANGED as const,
      userId: 'user-1',
      name: 'Ana',
      recipientEmail: 'ana@example.com',
      changedAt: '2026-10-10T13:00:00.000Z',
    },
    {
      type: NotificationJobType.EMAIL_CHANGED as const,
      userId: 'user-1',
      name: 'Ana',
      recipientEmail: 'ana@example.com',
      newEmail: 'ana@novo.com',
      changedAt: '2026-10-10T13:00:00.000Z',
    },
  ])('avisos de segurança ($type): grava o log com o userId', async (payload) => {
    await dispatch.execute(payload, 'job-10');

    expect(mail.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'ana@example.com' }));
    expect(saved[0]).toMatchObject({ donorId: null, userId: 'user-1', type: payload.type });
  });

  it('redefinição de senha: grava log com userId (sem donorId)', async () => {
    await dispatch.execute(
      {
        type: NotificationJobType.RESET_PASSWORD,
        userId: 'user-1',
        recipientEmail: 'admin@example.com',
        resetUrl: 'https://front.example.com/password-reset?token=abc',
        expiresInMinutes: 30,
      },
      'job-3',
    );

    expect(mail.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'admin@example.com' }));
    expect(saved[0]).toMatchObject({
      donorId: null,
      userId: 'user-1',
      type: NotificationJobType.RESET_PASSWORD,
      status: NotificationStatus.SENT,
      recipient: 'admin@example.com',
    });
  });
});
