import { AssessmentNotice, NotificationJobType } from '@shared/domain/enums';
import { escapeHtml, renderEmail } from '@src/application/templates/email-layout';
import {
  composeAppointmentBooked,
  composeAppointmentCanceled,
  composeAttendanceConfirmation,
  composeEligibleAgain,
  composeEmailChanged,
  composeEmailVerification,
  composeIntervalCompleted,
  composePasswordChanged,
  composeReminder24H,
  composeResetPassword,
  composeUrgentCampaign,
  composeWelcome,
  formatDateTimeAppointment,
  formatDayAndTime,
  greet,
} from '@src/application/templates/notification-templates';

const ctx = { frontendUrl: 'http://front.test' };
const base = {
  appointmentId: 'appointment-1',
  donorId: 'donor-1',
  donorName: 'Fulano',
  recipientEmail: 'fulano@example.com',
  // 13:00 UTC = 10:00 em Brasília
  dateTime: '2026-10-10T13:00:00.000Z',
  collectionUnitName: 'Unidade Central',
};
const url = 'http://front.test/confirm-attendance?token=abc.def';
const links = {
  pageUrl: 'http://front.test/unsubscribe?token=tk',
  oneClickUrl: 'http://api.test/donors/alerts/unsubscribe?token=tk',
};

describe('layout dos e-mails', () => {
  it('monta texto e HTML com o mesmo conteúdo, botão e rodapé', () => {
    const { text, html } = renderEmail({
      greeting: 'Olá, Ana!',
      paragraphs: ['Primeiro parágrafo.'],
      action: { label: 'Agendar', url: 'http://front.test/schedule' },
      afterAction: ['Depois do botão.'],
      footer: 'Rodapé.',
    });
    expect(text).toBe(
      'Olá, Ana!\n\nPrimeiro parágrafo.\n\nAgendar: http://front.test/schedule\n\nDepois do botão.\n\n--\nRodapé.',
    );
    expect(html).toContain('<a href="http://front.test/schedule"');
    // Declarado como português, para o Gmail/Chrome não "traduzirem" o texto.
    expect(html).toContain('<html lang="pt-BR" translate="no">');
    expect(html).toContain('Primeiro parágrafo.');
    expect(html).toContain('Rodapé.');
  });

  it('escapa o que vem de quem usa o sistema (nada de HTML injetado)', () => {
    const { html } = renderEmail({
      greeting: 'Olá, <b>Ana</b>!',
      paragraphs: ['<script>alert(1)</script>'],
      footer: 'x',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(escapeHtml(`"'&`)).toBe('&quot;&#39;&amp;');
  });
});

describe('modelos de e-mail', () => {
  it('cumprimenta pelo primeiro nome', () => {
    const { message } = composeAppointmentBooked(
      {
        type: NotificationJobType.APPOINTMENT_BOOKED,
        ...base,
        donorName: '  Maria  Souza da Silva ',
      },
      ctx,
    );
    expect(message.startsWith('Olá, Maria!')).toBe(true);
    expect(greet('')).toBe('Olá!');
  });

  it('formata a data no fuso de Brasília, independente do fuso do servidor', () => {
    expect(formatDateTimeAppointment(base.dateTime)).toMatch(/10\/10\/2026.*10:00/);
    expect(formatDayAndTime(base.dateTime)).toBe('10/10/2026 às 10:00');
  });

  describe('lembrete', () => {
    it('leva o botão de confirmação enquanto o doador não confirmou', () => {
      const { subject, message, html } = composeReminder24H(
        { type: NotificationJobType.REMINDER_24H, ...base, confirmationUrl: url },
        ctx,
      );
      expect(subject).toBe('Lembrete: sua doação de sangue está chegando');
      expect(message).toContain('10/10/2026 às 10:00, na unidade Unidade Central');
      expect(message).toContain(`Confirmar presença: ${url}`);
      expect(html).toContain('Confirmar presença');
    });

    it.each([null, undefined])('sem link (%s), vira só lembrete com o link da lista', (value) => {
      const { message } = composeReminder24H(
        { type: NotificationJobType.REMINDER_24H, ...base, confirmationUrl: value },
        ctx,
      );
      expect(message).not.toContain('Ainda não confirmou');
      expect(message).toContain('Ver meus agendamentos: http://front.test/appointments');
    });

    it('lembra o menor de levar o termo do responsável', () => {
      const { message } = composeReminder24H(
        {
          type: NotificationJobType.REMINDER_24H,
          ...base,
          notices: [AssessmentNotice.BRING_GUARDIAN_CONSENT],
        },
        ctx,
      );
      expect(message).toContain('termo de consentimento assinado pelo seu responsável legal');
    });
  });

  it('pedido de confirmação traz o botão e a dica de cancelar', () => {
    const { subject, message } = composeAttendanceConfirmation({
      type: NotificationJobType.ATTENDANCE_CONFIRMATION,
      ...base,
      confirmationUrl: url,
    });
    expect(subject).toBe('Confirme sua presença na doação de sangue');
    expect(message).toContain(url);
    expect(message).toContain('cancele pelo sistema');
  });

  it('confirmação do agendamento traz dia, unidade e o link da lista', () => {
    const { subject, message } = composeAppointmentBooked(
      { type: NotificationJobType.APPOINTMENT_BOOKED, ...base },
      ctx,
    );
    expect(subject).toBe('Agendamento confirmado: 10/10/2026 às 10:00');
    expect(message).toContain('Unidade Central');
    expect(message).toContain('http://front.test/appointments');
  });

  describe('cancelamento', () => {
    it('pela equipe: diz quem cancelou e o motivo', () => {
      const { subject, message } = composeAppointmentCanceled(
        {
          type: NotificationJobType.APPOINTMENT_CANCELED,
          ...base,
          reason: 'Unidade de coleta desativada.',
          canceledByStaff: true,
        },
        ctx,
      );
      expect(subject).toBe('Agendamento cancelado: 10/10/2026 às 10:00');
      expect(message).toContain('foi cancelado pela equipe do hemocentro');
      expect(message).toContain('Motivo: Unidade de coleta desativada.');
      expect(message).toContain('Agendar nova doação: http://front.test/schedule');
    });

    it('pelo doador, sem motivo: só registra o cancelamento', () => {
      const { message } = composeAppointmentCanceled(
        {
          type: NotificationJobType.APPOINTMENT_CANCELED,
          ...base,
          reason: null,
          canceledByStaff: false,
        },
        ctx,
      );
      expect(message).toContain('Confirmamos o cancelamento do seu agendamento');
      expect(message).not.toContain('Motivo:');
    });
  });

  describe('agradecimento pela doação', () => {
    it('informa a próxima data e que haverá aviso', () => {
      const { subject, message } = composeIntervalCompleted({
        type: NotificationJobType.INTERVAL_COMPLETED,
        donorId: 'd1',
        donorName: 'Ana',
        recipientEmail: 'ana@example.com',
        nextEligibilityDate: '2026-12-01',
      });
      expect(subject).toBe('Obrigado por doar!');
      expect(message).toContain('a partir de 01/12/2026');
      expect(message).toContain('avisaremos você por e-mail nesse dia');
    });

    it('sem próxima data, só agradece', () => {
      const { message } = composeIntervalCompleted({
        type: NotificationJobType.INTERVAL_COMPLETED,
        donorId: 'd1',
        donorName: 'Ana',
        recipientEmail: 'ana@example.com',
        nextEligibilityDate: null,
      });
      expect(message).not.toContain('a partir de');
    });
  });

  it('já pode doar: data, botão de agendar e como deixar de receber', () => {
    const { subject, message } = composeEligibleAgain(
      {
        type: NotificationJobType.ELIGIBLE_AGAIN,
        donorId: 'd1',
        donorName: 'Ana',
        recipientEmail: 'ana@example.com',
        eligibleSince: '2026-12-01',
      },
      ctx,
      links,
    );
    expect(subject).toBe('Você já pode doar sangue novamente');
    expect(message).toContain('A partir de hoje (01/12/2026), você já pode doar');
    expect(message).toContain('Agendar doação: http://front.test/schedule');
    expect(message).toContain(
      'Para não receber mais, acesse http://front.test/unsubscribe?token=tk',
    );
  });

  it('avisos que o doador pode deixar de receber levam o cabeçalho de descadastro de um clique', () => {
    const { headers } = composeEligibleAgain(
      {
        type: NotificationJobType.ELIGIBLE_AGAIN,
        donorId: 'd1',
        donorName: 'Ana',
        recipientEmail: 'ana@example.com',
        eligibleSince: '2026-12-01',
      },
      ctx,
      links,
    );
    expect(headers).toEqual({
      'List-Unsubscribe': '<http://api.test/donors/alerts/unsubscribe?token=tk>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
  });

  it('campanha urgente: personaliza por doador e diz como deixar de receber', () => {
    const { subject, message } = composeUrgentCampaign(
      {
        type: NotificationJobType.URGENT_CAMPAIGN,
        campaignId: 'c1',
        title: 'Precisamos de O-',
        message: 'Estoque crítico.',
        recipients: [],
      },
      'Beto',
      ctx,
      links,
    );
    expect(subject).toBe('Campanha urgente: Precisamos de O-');
    expect(message.startsWith('Olá, Beto!\n\nEstoque crítico.')).toBe(true);
    expect(message).toContain('http://front.test/unsubscribe?token=tk');
  });

  describe('redefinição de senha', () => {
    const payload = {
      type: NotificationJobType.RESET_PASSWORD as const,
      userId: 'u1',
      recipientEmail: 'a@example.com',
      resetUrl: 'https://front/reset?token=segredo123',
      expiresInMinutes: 15,
    };

    it('traz o link e a validade', () => {
      const { subject, message, html } = composeResetPassword(payload);
      expect(subject).toBe('Redefinição de senha');
      expect(message).toContain('O link vale por 15 minutos');
      expect(message).toContain(payload.resetUrl);
      expect(html).toContain(payload.resetUrl);
    });

    it('o texto que vai para o log de envios não leva o token', () => {
      const { loggedMessage } = composeResetPassword(payload);
      expect(loggedMessage).toContain('https://front/reset?token=[omitido]');
      expect(loggedMessage).not.toContain('segredo123');
    });
  });

  it('boas-vindas com o link de confirmação: botão de confirmar e o token fora do registro', () => {
    const { message, loggedMessage } = composeWelcome(
      {
        type: NotificationJobType.WELCOME,
        userId: 'u1',
        donorId: 'd1',
        name: 'Ana Souza',
        recipientEmail: 'ana@example.com',
        verificationUrl: 'http://front.test/verify-email?token=segredo',
      },
      ctx,
    );
    expect(message).toContain('Antes de agendar, confirme seu endereço de e-mail');
    expect(message).toContain('Confirmar meu e-mail: http://front.test/verify-email?token=segredo');
    expect(loggedMessage).not.toContain('segredo');
  });

  it('confirmação de e-mail: cadastro e troca têm textos próprios', () => {
    const base = {
      type: NotificationJobType.EMAIL_VERIFICATION as const,
      userId: 'u1',
      name: 'Ana',
      recipientEmail: 'ana@example.com',
      verificationUrl: 'http://front.test/verify-email?token=segredo',
      expiresInHours: 48,
    };
    const signup = composeEmailVerification({ ...base, purpose: 'signup' });
    const change = composeEmailVerification({ ...base, purpose: 'change' });

    expect(signup.subject).toBe('Confirme seu e-mail');
    expect(signup.message).toContain('para poder agendar');
    expect(change.subject).toBe('Confirme seu novo e-mail');
    expect(change.message).toContain('o e-mail de acesso só muda depois da confirmação');
    expect(change.message).toContain('O link vale por 48 horas');
    expect(change.loggedMessage).not.toContain('segredo');
  });

  it('senha alterada: quando, o que fazer se não foi você', () => {
    const { subject, message } = composePasswordChanged(
      {
        type: NotificationJobType.PASSWORD_CHANGED,
        userId: 'u1',
        name: 'Ana',
        recipientEmail: 'ana@example.com',
        changedAt: base.dateTime,
      },
      ctx,
    );
    expect(subject).toBe('Sua senha foi alterada');
    expect(message).toContain('alterada em 10/10/2026 às 10:00');
    expect(message).toContain('http://front.test/password-forgot');
  });

  it('e-mail alterado: vai ao endereço antigo, com o novo mascarado', () => {
    const { subject, message } = composeEmailChanged(
      {
        type: NotificationJobType.EMAIL_CHANGED,
        userId: 'u1',
        name: 'Ana',
        recipientEmail: 'ana@antigo.com',
        newEmail: 'ana.nova@novo.com',
        changedAt: base.dateTime,
      },
      ctx,
    );
    expect(subject).toBe('O e-mail da sua conta foi alterado');
    expect(message).toContain('an***@novo.com');
    expect(message).not.toContain('ana.nova@novo.com');
  });
});
