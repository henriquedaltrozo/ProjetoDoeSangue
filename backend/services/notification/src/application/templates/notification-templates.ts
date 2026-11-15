import {
  AppointmentBookedJobPayload,
  AppointmentCanceledJobPayload,
  AppointmentReminderJobPayload,
  AttendanceConfirmationJobPayload,
  EligibleAgainJobPayload,
  EmailVerificationJobPayload,
  EmailChangedJobPayload,
  IntervalCompletedJobPayload,
  NoShowJobPayload,
  WelcomeJobPayload,
  PasswordChangedJobPayload,
  ResetPasswordJobPayload,
  UrgentCampaignJobPayload,
} from '@shared/application/messaging';
import { AssessmentNotice } from '@shared/domain/enums';
import { type EmailContent, renderEmail } from './email-layout';

export interface NotificationMessage {
  subject: string;
  /** Versão texto (também é o que vai para o log de envios). */
  message: string;
  /** Versão HTML do mesmo conteúdo. */
  html: string;
  /**
   * Texto gravado no log de envios quando difere do enviado: sem segredos (ex.: o token do link de
   * redefinição de senha, que o auth guarda só como hash). Ausente = grava `message`.
   */
  loggedMessage?: string;
  /** Cabeçalhos extras (ex.: List-Unsubscribe nos avisos de que o doador pode sair). */
  headers?: Record<string, string>;
}

/** Links de descadastro de um doador (página com botão e rota de um clique). */
export interface UnsubscribeLinks {
  pageUrl: string;
  oneClickUrl: string;
}

/** O que os modelos precisam saber do ambiente: a base do front, para os links. */
export interface TemplateContext {
  frontendUrl: string;
}

/** Troca o valor de `token=` de um link por um marcador, para o texto poder ir ao log. */
export function redactTokens(text: string): string {
  return text.replace(/([?&]token=)[^&\s"<]+/g, '$1[omitido]');
}

/**
 * Fuso fixo de propósito: o worker roda em container (UTC) e, sem isso, o
 * e-mail mostraria o horário do agendamento 3 h adiantado para o doador.
 */
export const DISPLAY_TIMEZONE = 'America/Sao_Paulo';

export function formatDateTimeAppointment(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: DISPLAY_TIMEZONE,
  });
}

/** "10/10/2026 às 10:00", no fuso de Brasília. */
export function formatDayAndTime(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString('pt-BR', { timeZone: DISPLAY_TIMEZONE });
  const time = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: DISPLAY_TIMEZONE,
  });
  return `${day} às ${time}`;
}

/** Data de calendário AAAA-MM-DD como DD/MM/AAAA (sem fuso: já é um dia, não um instante). */
export function formatCalendarDate(dateISO: string): string {
  const [year, month, day] = dateISO.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

/** "fu***@example.com": o endereço novo aparece mascarado no aviso enviado ao antigo. */
export function maskAddress(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 2)}***@${domain}`;
}

/** "Olá, Maria!": só o primeiro nome, mais próximo que o nome completo do cadastro. */
export function greet(name: string): string {
  const first = name.trim().split(/\s+/)[0];
  return first ? `Olá, ${first}!` : 'Olá!';
}

/** Texto de cada aviso da avaliação de elegibilidade, repetido nos e-mails do agendamento. */
const NOTICE_TEXT: Record<AssessmentNotice, string> = {
  [AssessmentNotice.BRING_GUARDIAN_CONSENT]:
    'Importante: leve o termo de consentimento assinado pelo seu responsável legal. Sem ele, ' +
    'menores de 18 anos não podem doar.',
};

/** Parágrafos com os avisos do agendamento (vazio quando não há aviso). */
export function noticeParagraphs(notices: AssessmentNotice[] | undefined): string[] {
  return (notices ?? []).map((notice) => NOTICE_TEXT[notice]).filter(Boolean);
}

const FOOTER_ACCOUNT = 'Você recebeu este e-mail porque tem cadastro no DoeSangue.';
const FOOTER_SECURITY =
  'Este aviso de segurança é enviado sempre que algo importante muda na sua conta do DoeSangue.';

function footerAlerts(links: UnsubscribeLinks): string {
  return (
    'Você recebeu este e-mail porque optou por receber avisos de campanhas e de quando pode doar. ' +
    `Para não receber mais, acesse ${links.pageUrl} (ou desmarque a opção em Meu perfil).`
  );
}

/**
 * Cabeçalhos do descadastro de um clique (RFC 8058): o Gmail e o Outlook mostram o botão "cancelar
 * inscrição", que chama a rota da API direto, sem abrir o site.
 */
function unsubscribeHeaders(links: UnsubscribeLinks): Record<string, string> {
  return {
    'List-Unsubscribe': `<${links.oneClickUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

function message(
  subject: string,
  content: EmailContent,
  extra: Partial<NotificationMessage> = {},
): NotificationMessage {
  const { text, html } = renderEmail(content);
  return { subject, message: text, html, ...extra };
}

const CANCEL_HINT =
  'Se não puder comparecer, cancele pelo sistema para liberar a vaga para outro doador.';

export function composeReminder24H(
  payload: AppointmentReminderJobPayload,
  ctx: TemplateContext,
): NotificationMessage {
  const when = formatDayAndTime(payload.dateTime);
  const pending = Boolean(payload.confirmationUrl);
  return message('Lembrete: sua doação de sangue está chegando', {
    greeting: greet(payload.donorName),
    paragraphs: [
      `Sua doação está agendada para ${when}, na unidade ${payload.collectionUnitName}.`,
      ...noticeParagraphs(payload.notices),
      ...(pending
        ? [
            'Ainda não confirmou sua presença? Confirme pelo botão abaixo. O link vale até o horário do agendamento.',
          ]
        : []),
    ],
    action: payload.confirmationUrl
      ? { label: 'Confirmar presença', url: payload.confirmationUrl }
      : { label: 'Ver meus agendamentos', url: `${ctx.frontendUrl}/appointments` },
    afterAction: [CANCEL_HINT],
    footer: FOOTER_ACCOUNT,
  });
}

export function composeAttendanceConfirmation(
  payload: AttendanceConfirmationJobPayload,
): NotificationMessage {
  const when = formatDayAndTime(payload.dateTime);
  return message('Confirme sua presença na doação de sangue', {
    greeting: greet(payload.donorName),
    paragraphs: [
      `Sua doação está agendada para ${when}, na unidade ${payload.collectionUnitName}.`,
      ...noticeParagraphs(payload.notices),
      'Confirme sua presença pelo botão abaixo. O link vale até o horário do agendamento.',
    ],
    action: { label: 'Confirmar presença', url: payload.confirmationUrl },
    afterAction: [CANCEL_HINT],
    footer: FOOTER_ACCOUNT,
  });
}

export function composeAppointmentBooked(
  payload: AppointmentBookedJobPayload,
  ctx: TemplateContext,
): NotificationMessage {
  const when = formatDayAndTime(payload.dateTime);
  return message(`Agendamento confirmado: ${when}`, {
    greeting: greet(payload.donorName),
    paragraphs: [
      `Sua doação de sangue foi agendada para ${when}, na unidade ${payload.collectionUnitName}.`,
      ...noticeParagraphs(payload.notices),
      'Perto da data, você vai receber um pedido de confirmação de presença e um lembrete.',
    ],
    action: { label: 'Ver meus agendamentos', url: `${ctx.frontendUrl}/appointments` },
    afterAction: [CANCEL_HINT],
    footer: FOOTER_ACCOUNT,
  });
}

export function composeAppointmentCanceled(
  payload: AppointmentCanceledJobPayload,
  ctx: TemplateContext,
): NotificationMessage {
  const when = formatDayAndTime(payload.dateTime);
  const who = payload.canceledByStaff
    ? `Seu agendamento de ${when}, na unidade ${payload.collectionUnitName}, foi cancelado pela equipe do hemocentro.`
    : `Confirmamos o cancelamento do seu agendamento de ${when}, na unidade ${payload.collectionUnitName}.`;
  return message(`Agendamento cancelado: ${when}`, {
    greeting: greet(payload.donorName),
    paragraphs: [
      who,
      ...(payload.reason ? [`Motivo: ${payload.reason}`] : []),
      'Quando quiser, é só marcar um novo horário.',
    ],
    action: { label: 'Agendar nova doação', url: `${ctx.frontendUrl}/schedule` },
    footer: FOOTER_ACCOUNT,
  });
}

export function composeNoShow(
  payload: NoShowJobPayload,
  ctx: TemplateContext,
): NotificationMessage {
  const when = formatDayAndTime(payload.dateTime);
  return message(`Sentimos sua falta na doação de ${when}`, {
    greeting: greet(payload.donorName),
    paragraphs: [
      `Não registramos sua presença no agendamento de ${when}, na unidade ${payload.collectionUnitName}.`,
      'Imprevistos acontecem. Quando puder, marque um novo horário: sua doação faz diferença.',
    ],
    action: { label: 'Agendar nova doação', url: `${ctx.frontendUrl}/schedule` },
    afterAction: [
      'Se algum dia não puder comparecer, cancele pelo sistema para liberar a vaga para outro doador.',
    ],
    footer: FOOTER_ACCOUNT,
  });
}

export function composeWelcome(
  payload: WelcomeJobPayload,
  ctx: TemplateContext,
): NotificationMessage {
  const verify = payload.verificationUrl;
  const built = message('Boas-vindas ao DoeSangue', {
    greeting: greet(payload.name),
    paragraphs: [
      'Seu cadastro de doador foi concluído. Obrigado por se cadastrar para doar sangue!',
      ...(verify
        ? [
            'Antes de agendar, confirme seu endereço de e-mail pelo botão abaixo. O link vale por 48 horas.',
          ]
        : []),
      'Próximos passos:\n' +
        '1. Na página inicial, veja se você já pode doar (o sistema confere idade, peso, intervalo ' +
        'entre doações e inaptidões).\n' +
        '2. Escolha uma unidade de coleta e um horário.\n' +
        '3. No dia, leve um documento oficial com foto, durma bem na noite anterior e faça uma ' +
        'refeição leve (evite alimentos gordurosos nas 3 horas antes).',
      'Você vai receber a confirmação do agendamento, um lembrete na véspera e, depois de doar, ' +
        'um aviso quando puder doar de novo.',
      ...(verify ? ['Se você não fez este cadastro, ignore este e-mail.'] : []),
    ],
    action: verify
      ? { label: 'Confirmar meu e-mail', url: verify }
      : { label: 'Acessar o DoeSangue', url: ctx.frontendUrl },
    footer: FOOTER_ACCOUNT,
  });
  return verify ? { ...built, loggedMessage: redactTokens(built.message) } : built;
}

export function composeEmailVerification(
  payload: EmailVerificationJobPayload,
): NotificationMessage {
  const change = payload.purpose === 'change';
  const built = message(change ? 'Confirme seu novo e-mail' : 'Confirme seu e-mail', {
    greeting: greet(payload.name),
    paragraphs: change
      ? [
          'Recebemos um pedido para usar este endereço como o novo e-mail da sua conta no DoeSangue. ' +
            'Confirme pelo botão abaixo: o e-mail de acesso só muda depois da confirmação.',
          `O link vale por ${payload.expiresInHours} horas.`,
        ]
      : [
          'Confirme seu endereço de e-mail pelo botão abaixo para poder agendar suas doações.',
          `O link vale por ${payload.expiresInHours} horas.`,
        ],
    action: {
      label: change ? 'Confirmar novo e-mail' : 'Confirmar meu e-mail',
      url: payload.verificationUrl,
    },
    afterAction: [
      change
        ? 'Se você não pediu essa troca, ignore este e-mail: nada muda na conta.'
        : 'Se você não criou uma conta no DoeSangue, ignore este e-mail.',
    ],
    footer: FOOTER_SECURITY,
  });
  return { ...built, loggedMessage: redactTokens(built.message) };
}

export function composeIntervalCompleted(
  payload: IntervalCompletedJobPayload,
): NotificationMessage {
  return message('Obrigado por doar!', {
    greeting: greet(payload.donorName),
    paragraphs: [
      'Obrigado por doar sangue. Uma doação pode ajudar até quatro pessoas.',
      ...(payload.nextEligibilityDate
        ? [
            `Você poderá doar novamente a partir de ${formatCalendarDate(payload.nextEligibilityDate)}. ` +
              'Se a opção de avisos estiver marcada em Meu perfil, avisaremos você por e-mail nesse dia.',
          ]
        : []),
    ],
    footer: FOOTER_ACCOUNT,
  });
}

export function composeEligibleAgain(
  payload: EligibleAgainJobPayload,
  ctx: TemplateContext,
  links: UnsubscribeLinks,
): NotificationMessage {
  return message(
    'Você já pode doar sangue novamente',
    {
      greeting: greet(payload.donorName),
      paragraphs: [
        `A partir de hoje (${formatCalendarDate(payload.eligibleSince)}), você já pode doar sangue de novo.`,
        'Escolha uma unidade e um horário: sua doação faz diferença. Se já tiver agendado, é só comparecer.',
      ],
      action: { label: 'Agendar doação', url: `${ctx.frontendUrl}/schedule` },
      footer: footerAlerts(links),
    },
    { headers: unsubscribeHeaders(links) },
  );
}

export function composeUrgentCampaign(
  payload: UrgentCampaignJobPayload,
  donorName: string,
  ctx: TemplateContext,
  links: UnsubscribeLinks,
): NotificationMessage {
  return message(
    `Campanha urgente: ${payload.title}`,
    {
      greeting: greet(donorName),
      paragraphs: [payload.message],
      action: { label: 'Agendar doação', url: `${ctx.frontendUrl}/schedule` },
      footer: footerAlerts(links),
    },
    { headers: unsubscribeHeaders(links) },
  );
}

export function composeResetPassword(payload: ResetPasswordJobPayload): NotificationMessage {
  const content: EmailContent = {
    greeting: 'Olá!',
    paragraphs: [
      'Recebemos uma solicitação para redefinir a senha da sua conta no DoeSangue. Use o botão ' +
        `abaixo para criar uma nova senha. O link vale por ${payload.expiresInMinutes} minutos.`,
    ],
    action: { label: 'Redefinir senha', url: payload.resetUrl },
    afterAction: [
      'Se você não fez essa solicitação, pode ignorar este e-mail: sua senha continua a mesma.',
    ],
    footer: FOOTER_SECURITY,
  };
  const built = message('Redefinição de senha', content);
  // O token dá acesso à troca de senha: vai só no e-mail, nunca no log de envios.
  return { ...built, loggedMessage: redactTokens(built.message) };
}

export function composePasswordChanged(
  payload: PasswordChangedJobPayload,
  ctx: TemplateContext,
): NotificationMessage {
  return message('Sua senha foi alterada', {
    greeting: greet(payload.name),
    paragraphs: [
      `A senha da sua conta no DoeSangue foi alterada em ${formatDayAndTime(payload.changedAt)}. ` +
        'Por segurança, todas as sessões abertas em outros aparelhos foram encerradas.',
      'Se foi você, não precisa fazer nada. Se não foi, redefina sua senha agora pelo botão abaixo.',
    ],
    action: { label: 'Redefinir senha', url: `${ctx.frontendUrl}/password-forgot` },
    footer: FOOTER_SECURITY,
  });
}

export function composeEmailChanged(
  payload: EmailChangedJobPayload,
  ctx: TemplateContext,
): NotificationMessage {
  return message('O e-mail da sua conta foi alterado', {
    greeting: greet(payload.name),
    paragraphs: [
      `O e-mail de acesso da sua conta no DoeSangue foi trocado em ${formatDayAndTime(payload.changedAt)} ` +
        `para ${maskAddress(payload.newEmail)}. A partir de agora, este endereço não recebe mais os avisos da conta.`,
      'Se foi você, não precisa fazer nada. Se não foi, entre em contato com o hemocentro o quanto ' +
        'antes: a troca do e-mail exige a senha atual, então sua senha pode ter sido descoberta.',
    ],
    action: { label: 'Acessar o DoeSangue', url: `${ctx.frontendUrl}/login` },
    footer: FOOTER_SECURITY,
  });
}
