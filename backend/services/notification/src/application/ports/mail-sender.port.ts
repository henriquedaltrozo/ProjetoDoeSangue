export interface EmailParams {
  to: string;
  subject: string;
  text: string;
  /** Versão HTML do mesmo conteúdo; o texto vai junto para leitores sem HTML. */
  html?: string;
  /** Cabeçalhos extras (ex.: List-Unsubscribe, para o botão "cancelar inscrição" do Gmail/Outlook). */
  headers?: Record<string, string>;
}

export const MAIL_SENDER = Symbol('MAIL_SENDER');

/**
 * Lança em caso de falha de envio - quem chama decide o que fazer com isso
 * (registrar NotificationStatus.FAILURE).
 */
export interface MailSender {
  send(params: EmailParams): Promise<void>;
}
