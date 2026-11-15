/**
 * Calendário do negócio: o hemocentro opera no horário de Brasília, então "hoje", "o dia de um
 * agendamento" e "a idade do doador" são calculados nesse fuso, qualquer que seja o fuso do
 * servidor (o container roda em UTC; a máquina de desenvolvimento, não necessariamente).
 * Instantes continuam em UTC (Date); só a conversão para datas de calendário passa por aqui.
 */
export const BUSINESS_TIMEZONE = 'America/Sao_Paulo';

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const offsetFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIMEZONE,
  timeZoneName: 'longOffset',
});

const weekdayTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIMEZONE,
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Dia da semana (0 = domingo) e hora (HH:MM) de um instante, no fuso do negócio. */
export function toBusinessWeekdayTime(instant: Date): { weekday: number; time: string } {
  const parts = weekdayTimeFormatter.formatToParts(instant);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    weekday: WEEKDAYS.indexOf(part('weekday')),
    time: `${part('hour')}:${part('minute')}`,
  };
}

/** Data de calendário (AAAA-MM-DD) de um instante, no fuso do negócio. */
export function toBusinessDate(instant: Date): string {
  return dateFormatter.format(instant);
}

/** Diferença do fuso do negócio para UTC no instante dado, em minutos (ex.: -180 para UTC-3). */
function offsetMinutesAt(instant: Date): number {
  const name = offsetFormatter.formatToParts(instant).find((p) => p.type === 'timeZoneName');
  const match = name?.value.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  if (!match) return 0; // "GMT" puro: sem diferença
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === '-' ? -minutes : minutes;
}

/** Instante em que começa o dia AAAA-MM-DD no fuso do negócio. */
function startOfBusinessDay(dateISO: string): Date {
  const utcMidnight = new Date(`${dateISO}T00:00:00.000Z`);
  return new Date(utcMidnight.getTime() - offsetMinutesAt(utcMidnight) * 60_000);
}

/** Primeiro e último instante (inclusive) do dia AAAA-MM-DD no fuso do negócio. */
export function businessDayInterval(dateISO: string): { start: Date; end: Date } {
  const start = startOfBusinessDay(dateISO);
  const next = new Date(`${dateISO}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const end = new Date(startOfBusinessDay(next.toISOString().slice(0, 10)).getTime() - 1);
  return { start, end };
}

/** Idade em anos completos na data de calendário do instante, no fuso do negócio. */
export function ageOn(birthDateISO: string, instant: Date): number {
  const [birthYear, birthMonth, birthDay] = birthDateISO.slice(0, 10).split('-').map(Number);
  const [year, month, day] = toBusinessDate(instant).split('-').map(Number);
  const hadBirthday = month > birthMonth || (month === birthMonth && day >= birthDay);
  return year - birthYear - (hadBirthday ? 0 : 1);
}
