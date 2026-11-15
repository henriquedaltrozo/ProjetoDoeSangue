import { expect } from '@playwright/test'

/**
 * Leitura da caixa do Mailpit (o SMTP de teste do docker-compose) pela API HTTP dele. O e2e só funciona
 * com a stack enviando para o Mailpit: com um SMTP real (Gmail etc.), os e-mails não chegam aqui.
 */
const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:8025'

interface MessageSummary {
  ID: string
  Subject: string
}

export interface Email {
  subject: string
  text: string
  html: string
  /** Cabeçalhos, com o nome como vem do e-mail (ex.: 'List-Unsubscribe'). */
  headers: Record<string, string[]>
}

/** Falha cedo, com uma mensagem clara, se o Mailpit não está no ar. */
export async function ensureMailpit(): Promise<void> {
  const response = await fetch(`${MAILPIT_URL}/api/v1/info`).catch(() => null)
  if (!response?.ok) {
    throw new Error(
      `Mailpit fora do ar em ${MAILPIT_URL}. Suba a stack com o SMTP padrão (Mailpit), não com um SMTP real.`,
    )
  }
}

/**
 * Espera chegar para `to` um e-mail cujo assunto contenha `subject` e o devolve (o mais recente). Os
 * e-mails passam pela fila, então podem levar alguns segundos.
 */
export async function waitForEmail(to: string, subject: string, timeoutMs = 30_000): Promise<Email> {
  const query = encodeURIComponent(`to:"${to}" subject:"${subject}"`)
  let found: MessageSummary | undefined
  await expect
    .poll(
      async () => {
        const response = await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}`)
        const body = (await response.json()) as { messages: MessageSummary[] }
        found = body.messages.find((m) => m.Subject.includes(subject))
        return Boolean(found)
      },
      { message: `e-mail "${subject}" para ${to}`, timeout: timeoutMs, intervals: [500, 1000, 2000] },
    )
    .toBe(true)
  const id = (found as MessageSummary).ID
  const [message, headers] = await Promise.all([
    fetch(`${MAILPIT_URL}/api/v1/message/${id}`).then((r) => r.json() as Promise<{ Text: string; HTML: string }>),
    fetch(`${MAILPIT_URL}/api/v1/message/${id}/headers`).then((r) => r.json() as Promise<Record<string, string[]>>),
  ])
  return { subject: (found as MessageSummary).Subject, text: message.Text, html: message.HTML, headers }
}

/** O primeiro link do e-mail (na versão em texto) que contém `path`, ex.: '/verify-email'. */
export function linkIn(email: Email, path: string): string {
  const link = email.text.match(/https?:\/\/\S+/g)?.find((url) => url.includes(path))
  if (!link) throw new Error(`Link com "${path}" não encontrado no e-mail "${email.subject}".`)
  return link
}

/** Caminho + query de um link absoluto, para abrir no front do teste (que pode ter outra origem). */
export function pathOf(link: string): string {
  const url = new URL(link)
  return `${url.pathname}${url.search}`
}
