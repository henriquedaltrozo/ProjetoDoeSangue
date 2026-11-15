/** Mesma grade do back (SLOT_MINUTES): os horários de agendamento são de 30 em 30 minutos. */
export const SLOT_MINUTES = 30

/** Faixa oferecida quando a unidade não cadastrou o horário de funcionamento. */
export const DEFAULT_RANGE = '07:00-19:00'

/** Chaves de dia da semana do horário de funcionamento, na ordem de Date#getDay (0 = domingo). */
const WEEKDAY_KEYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']

function normalizeWeekday(key: string): string {
  return key.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().slice(0, 3)
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function toTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

/**
 * Tira da lista os horários que já passaram, quando o dia escolhido é hoje (em Brasília): o backend
 * só aceita agendamentos no futuro.
 */
export function upcomingSlots(slots: string[], date: string, today: string, nowTime: string): string[] {
  if (date !== today) return date < today ? [] : slots
  return slots.filter((slot) => slot > nowTime)
}

/**
 * Horários (HH:MM) que a unidade oferece no dia AAAA-MM-DD: de 30 em 30 minutos, dentro das faixas do
 * horário de funcionamento daquele dia da semana (o início entra, o fim não). Sem horário cadastrado,
 * usa DEFAULT_RANGE; com horário cadastrado e nada para o dia, a unidade não atende (lista vazia).
 */
export function slotTimes(operatingHours: Record<string, string[]> | null | undefined, dateISO: string): string[] {
  const hasHours = operatingHours && Object.keys(operatingHours).length > 0
  const weekday = WEEKDAY_KEYS[new Date(`${dateISO}T12:00:00Z`).getUTCDay()]
  const ranges = hasHours
    ? Object.entries(operatingHours)
        .filter(([day]) => normalizeWeekday(day) === weekday)
        .flatMap(([, list]) => list)
    : [DEFAULT_RANGE]
  const times = new Set<number>()
  for (const range of ranges) {
    const [start, end] = range.split('-').map(toMinutes)
    const first = Math.ceil(start / SLOT_MINUTES) * SLOT_MINUTES
    for (let minutes = first; minutes < end; minutes += SLOT_MINUTES) {
      times.add(minutes)
    }
  }
  return [...times].sort((a, b) => a - b).map(toTime)
}
