/**
 * Fuso do hemocentro: o backend calcula o dia, a grade de horários e o funcionamento das unidades
 * no horário de Brasília, então a tela mostra e monta horários nesse fuso, qualquer que seja o do
 * navegador (Acre, Manaus, um viajante no exterior...).
 */
export const BUSINESS_TIMEZONE = 'America/Sao_Paulo'

/**
 * Deslocamento de Brasília em relação ao UTC. Fixo: o Brasil não tem horário de verão desde 2019.
 * Se voltar a ter, trocar por um cálculo com Intl.
 */
const BUSINESS_UTC_OFFSET = '-03:00'

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: BUSINESS_TIMEZONE,
  })
}

const businessDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const businessTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: BUSINESS_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** Dia (AAAA-MM-DD) de um instante no horário de Brasília - "hoje" para o backend. */
export function businessDate(instant: Date = new Date()): string {
  return businessDateFormatter.format(instant)
}

/** Hora (HH:MM) de um instante no horário de Brasília. */
export function businessTime(instant: Date = new Date()): string {
  return businessTimeFormatter.format(instant)
}

/** Instante (ISO, UTC) de um dia AAAA-MM-DD e hora HH:MM no horário de Brasília. */
export function businessDateTimeToISO(date: string, time: string): string {
  return new Date(`${date}T${time}:00${BUSINESS_UTC_OFFSET}`).toISOString()
}

/** Soma dias a uma data AAAA-MM-DD (aritmética de calendário, sem fuso). */
export function addDaysISO(date: string, days: number): string {
  const result = new Date(`${date}T12:00:00.000Z`)
  result.setUTCDate(result.getUTCDate() + days)
  return result.toISOString().slice(0, 10)
}

export function formatDate(iso: string): string {
  // Datas "YYYY-MM-DD" vindas do backend (colunas `date`) não têm horário -
  // interpretamos como meio-dia UTC para não sofrer o deslocamento de um dia
  // para trás em fusos horários negativos.
  const date = iso.length === 10 ? new Date(`${iso}T12:00:00.000Z`) : new Date(iso)
  return date.toLocaleDateString('pt-BR', { dateStyle: 'short' })
}

export function formatCpf(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

/**
 * Data local no formato "YYYY-MM-DD" (o valor de um `<input type="date">`). Não usa
 * `toISOString()`, que converte para UTC: no Brasil, depois das 21h, isso já daria o dia seguinte.
 */
export function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
