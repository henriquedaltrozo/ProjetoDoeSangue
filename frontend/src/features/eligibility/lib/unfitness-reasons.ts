import type { UnfitnessCategory } from '@/shared/types'

/** Prazo de uma inaptidão temporária, contado a partir do início. */
export interface UnfitnessDuration {
  days?: number
  months?: number
}

export interface TemporaryReason {
  id: string
  /** Texto gravado como motivo. */
  label: string
  category: UnfitnessCategory
  /** null: sem prazo fixo (o admin informa o fim, ou encerra quando liberar). */
  duration: UnfitnessDuration | null
  /** Prazo de referência, mostrado ao admin. */
  rule: string
}

/** Valor do item "Outro (descrever)" nas listas de motivos. */
export const OTHER_REASON = 'outro'

/**
 * Motivos comuns de inaptidão temporária, com a categoria e o prazo de referência das normas de
 * triagem (Portaria de Consolidação GM/MS nº 5/2017 e RDC Anvisa nº 34/2014). Os prazos são
 * referências: o admin ajusta o fim previsto quando o caso pedir, e a triagem clínica decide.
 */
export const TEMPORARY_REASONS: TemporaryReason[] = [
  {
    id: 'gripe',
    label: 'Gripe, resfriado ou febre',
    category: 'CLINIC',
    duration: { days: 7 },
    rule: '7 dias após o fim dos sintomas',
  },
  { id: 'extracao', label: 'Extração dentária', category: 'CLINIC', duration: { days: 7 }, rule: '7 dias' },
  {
    id: 'cirurgia-pequena',
    label: 'Cirurgia de pequeno porte',
    category: 'CLINIC',
    duration: { months: 3 },
    rule: '3 meses',
  },
  {
    id: 'cirurgia-grande',
    label: 'Cirurgia de grande porte',
    category: 'CLINIC',
    duration: { months: 6 },
    rule: '6 a 12 meses, conforme a cirurgia',
  },
  {
    id: 'endoscopia',
    label: 'Endoscopia ou colonoscopia',
    category: 'CLINIC',
    duration: { months: 6 },
    rule: '6 meses',
  },
  { id: 'gravidez', label: 'Gravidez', category: 'CLINIC', duration: null, rule: 'durante toda a gestação' },
  {
    id: 'parto-normal',
    label: 'Parto normal',
    category: 'CLINIC',
    duration: { days: 90 },
    rule: '90 dias após o parto',
  },
  {
    id: 'parto-cesarea',
    label: 'Parto por cesárea',
    category: 'CLINIC',
    duration: { days: 180 },
    rule: '180 dias após o parto',
  },
  {
    id: 'amamentacao',
    label: 'Amamentação',
    category: 'CLINIC',
    duration: null,
    rule: 'enquanto amamenta, até 12 meses após o parto',
  },
  {
    id: 'vacina',
    label: 'Vacina recente',
    category: 'CLINIC',
    duration: null,
    rule: 'de 48 horas a 4 semanas, conforme a vacina',
  },
  {
    id: 'transfusao',
    label: 'Transfusão de sangue recebida',
    category: 'CLINIC',
    duration: { months: 12 },
    rule: '12 meses',
  },
  {
    id: 'tatuagem',
    label: 'Tatuagem, maquiagem definitiva ou piercing',
    category: 'BEHAVIORAL',
    duration: { months: 12 },
    rule: '12 meses',
  },
  {
    id: 'relacao-risco',
    label: 'Relação sexual de risco',
    category: 'BEHAVIORAL',
    duration: { months: 12 },
    rule: '12 meses',
  },
  {
    id: 'alcool',
    label: 'Ingestão de bebida alcoólica',
    category: 'BEHAVIORAL',
    duration: { days: 0 },
    rule: '12 horas (volta a doar no dia seguinte)',
  },
  {
    id: 'exame-alterado',
    label: 'Exame alterado (aguardando repetição)',
    category: 'LABORATORY',
    duration: null,
    rule: 'até o resultado do novo exame',
  },
  {
    id: 'anemia',
    label: 'Hemoglobina baixa (anemia)',
    category: 'LABORATORY',
    duration: null,
    rule: 'até a hemoglobina normalizar',
  },
]

/** Motivos comuns de inaptidão permanente (mesmas normas de triagem). */
export const PERMANENT_REASONS: string[] = [
  'Hepatite B ou C',
  'HIV ou HTLV',
  'Doença de Chagas',
  'Uso de drogas injetáveis',
  'Câncer',
  'Doença cardíaca grave',
  'Diabetes tratada com insulina',
  'Doença de Creutzfeldt-Jakob ou risco para ela',
]

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Soma meses a uma data; num mês mais curto, fica no último dia (31/01 + 1 mês = 28/02). */
function addMonths(iso: string, months: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1 + months, 1, 12))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return target.toISOString().slice(0, 10)
}

/**
 * Fim previsto (último dia da inaptidão) para um prazo a partir do início: o doador volta a poder
 * doar no dia seguinte, ou seja, exatamente quando o prazo termina (ex.: 7 dias a partir de 05/11
 * libera em 12/11, então o último dia é 11/11).
 */
export function expectedEndFor(startDate: string, duration: UnfitnessDuration): string {
  const released = duration.months ? addMonths(startDate, duration.months) : addDays(startDate, duration.days ?? 0)
  return released > startDate ? addDays(released, -1) : startDate
}
