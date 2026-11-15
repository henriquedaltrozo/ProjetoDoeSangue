import { ageOn, toBusinessDate } from '@shared/domain/time';

/** Data de calendário (AAAA-MM-DD) de um instante, no fuso do negócio (Brasília). */
export function toDateISO(instant: Date): string {
  return toBusinessDate(instant);
}

/** Idade completa em anos na data de referência, no fuso do negócio (aniversário ainda não ocorrido não conta). */
export function calculateAge(birthDateISO: string, reference: Date): number {
  return ageOn(birthDateISO, reference);
}

/**
 * Idade completa em anos numa data de calendário AAAA-MM-DD (ex.: o dia da doação agendada). Mesmo
 * critério de `calculateAge` e `birthdayAt`: quem nasceu em 29/02 completa ano em 01/03 nos anos não
 * bissextos.
 */
export function ageOnDate(birthDateISO: string, dateISO: string): number {
  const [birthYear, birthMonth, birthDay] = birthDateISO.slice(0, 10).split('-').map(Number);
  const [year, month, day] = dateISO.slice(0, 10).split('-').map(Number);
  const hadBirthday = month > birthMonth || (month === birthMonth && day >= birthDay);
  return year - birthYear - (hadBirthday ? 0 : 1);
}

/** Soma `days` a uma data de calendário AAAA-MM-DD e devolve AAAA-MM-DD (aritmética de calendário, sem fuso). */
export function addDays(dateISO: string, days: number): string {
  const date = new Date(`${dateISO}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Soma `months` meses a uma data AAAA-MM-DD. Se o dia não existir no mês de destino (ex.: 31 de
 * dezembro + 2 meses), usa o último dia do mês (aritmética de calendário, sem fuso).
 */
export function addMonths(dateISO: string, months: number): string {
  const [year, month, day] = dateISO.split('-').map(Number);
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = index - targetYear * 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const pad = (n: number, size = 2) => String(n).padStart(size, '0');
  return `${pad(targetYear, 4)}-${pad(targetMonth + 1)}-${pad(Math.min(day, lastDay))}`;
}

/**
 * Data (AAAA-MM-DD) em que quem nasceu em `birthDateISO` completa `years` anos. Quem nasceu em
 * 29/02 completa ano em 01/03 nos anos não bissextos - o mesmo critério de `calculateAge`, para as
 * duas regras nunca discordarem.
 */
export function birthdayAt(birthDateISO: string, years: number): string {
  const [birthYear, month, day] = birthDateISO.slice(0, 10).split('-').map(Number);
  const year = birthYear + years;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (n: number, size = 2) => String(n).padStart(size, '0');
  return day > lastDay
    ? `${pad(year, 4)}-${pad(month + 1)}-01`
    : `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}
