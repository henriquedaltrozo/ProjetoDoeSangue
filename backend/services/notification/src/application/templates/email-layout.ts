/** Conteúdo de um e-mail, montado nas duas versões (texto e HTML) pelo mesmo layout. */
export interface EmailContent {
  /** Primeira linha (ex.: "Olá, Ana!"). */
  greeting: string;
  /** Parágrafos antes do botão. */
  paragraphs: string[];
  /** Botão de ação (na versão texto, vira "Rótulo: link"). */
  action?: { label: string; url: string };
  /** Parágrafos depois do botão. */
  afterAction?: string[];
  /** Rodapé: por que a pessoa recebeu este e-mail. */
  footer: string;
}

export interface RenderedEmail {
  text: string;
  html: string;
}

const BRAND = '#b91c1c';

/** Escapa o texto para HTML: nomes, títulos e mensagens vêm de quem usa o sistema. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Parágrafo HTML: quebras de linha do texto viram <br>. */
function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;line-height:1.5">${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
}

function button(action: { label: string; url: string }): string {
  const url = escapeHtml(action.url);
  return (
    '<p style="margin:24px 0">' +
    `<a href="${url}" style="display:inline-block;background:${BRAND};color:#ffffff;` +
    'text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px">' +
    `${escapeHtml(action.label)}</a></p>`
  );
}

/** Versão texto: o que leitores sem HTML (e o log de envios) mostram. */
function renderText(content: EmailContent): string {
  const parts = [content.greeting, ...content.paragraphs];
  if (content.action) parts.push(`${content.action.label}: ${content.action.url}`);
  parts.push(...(content.afterAction ?? []));
  return `${parts.join('\n\n')}\n\n--\n${content.footer}`;
}

/** Versão HTML: tabela simples com estilos inline (o que os clientes de e-mail aceitam). */
function renderHtml(content: EmailContent): string {
  const body = [
    paragraph(content.greeting),
    ...content.paragraphs.map(paragraph),
    content.action ? button(content.action) : '',
    ...(content.afterAction ?? []).map(paragraph),
  ].join('');
  return (
    // pt-BR declarado (e sem tradução automática): o Gmail/Chrome às vezes "traduzem" o português
    // para português e estragam o texto.
    '<!doctype html><html lang="pt-BR" translate="no"><head><meta charset="utf-8">' +
    '<meta http-equiv="Content-Language" content="pt-BR"><meta name="google" content="notranslate">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9">' +
    '<tr><td align="center" style="padding:24px 12px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ' +
    'style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">' +
    `<tr><td style="background:${BRAND};padding:16px 24px;color:#ffffff;font-size:20px;font-weight:bold">DoeSangue</td></tr>` +
    `<tr><td style="padding:24px;font-size:15px">${body}</td></tr>` +
    '<tr><td style="padding:16px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;line-height:1.5">' +
    `${escapeHtml(content.footer)}</td></tr>` +
    '</table></td></tr></table></body></html>'
  );
}

export function renderEmail(content: EmailContent): RenderedEmail {
  return { text: renderText(content), html: renderHtml(content) };
}
