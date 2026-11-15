import { z } from 'zod'
import { onlyDigits } from '@/shared/lib/masks'

// --- [admin] ---

/** Dias da semana do horário de funcionamento (chaves que o backend aceita), de domingo a sábado. */
export const WEEKDAYS = [
  { key: 'dom', label: 'Domingo' },
  { key: 'seg', label: 'Segunda' },
  { key: 'ter', label: 'Terça' },
  { key: 'qua', label: 'Quarta' },
  { key: 'qui', label: 'Quinta' },
  { key: 'sex', label: 'Sexta' },
  { key: 'sab', label: 'Sábado' },
] as const

const dayHours = z.object({ open: z.boolean(), start: z.string(), end: z.string() })

/** Um dia por linha, todos fechados: sem nenhum dia marcado, a unidade aceita qualquer horário da grade. */
export const EMPTY_WEEK_HOURS = WEEKDAYS.map(() => ({ open: false, start: '08:00', end: '17:00' }))

export const createUnitSchema = z
  .object({
    name: z.string().min(3, 'Informe o nome da unidade.').max(150),
    address: z.string().min(3, 'Informe o endereço.').max(255),
    neighborhood: z.string().trim().min(2, 'Informe o bairro.').max(100),
    city: z.string().min(2, 'Informe a cidade.').max(100),
    uf: z
      .string()
      .regex(/^[A-Za-z]{2}$/, 'UF deve ter 2 letras.')
      .toUpperCase(),
    // Com ou sem máscara: sai só com os dígitos (DDD + número, 10 ou 11 dígitos).
    phone: z
      .string()
      .transform(onlyDigits)
      .refine(
        (value) => value.length === 10 || value.length === 11,
        'Informe o telefone com DDD, ex.: (55) 3333-4444.',
      ),
    simultaneousCapacity: z.coerce.number().int().min(1, 'Informe uma capacidade válida.'),
    hours: z.array(dayHours).length(WEEKDAYS.length),
  })
  .superRefine((values, ctx) => {
    values.hours.forEach((day, i) => {
      if (day.open && !(day.start && day.end && day.start < day.end)) {
        ctx.addIssue({
          code: 'custom',
          path: ['hours', i, 'end'],
          message: 'O fim precisa ser depois do início.',
        })
      }
    })
  })
  // O backend recebe { "seg": ["08:00-17:00"], ... } só com os dias marcados (ou nada).
  .transform(({ hours, ...rest }) => {
    const operatingHours: Record<string, string[]> = {}
    hours.forEach((day, i) => {
      if (day.open) operatingHours[WEEKDAYS[i].key] = [`${day.start}-${day.end}`]
    })
    return { ...rest, ...(Object.keys(operatingHours).length > 0 && { operatingHours }) }
  })
export type CreateUnitFormValues = z.infer<typeof createUnitSchema>
