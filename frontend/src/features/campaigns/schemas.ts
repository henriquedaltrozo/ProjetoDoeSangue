import { z } from 'zod'
import { businessDate } from '@/shared/lib/format'
import { BLOOD_TYPES, CAMPAIGN_TYPES } from '@/shared/types'

export const createCampaignSchema = z
  .object({
    title: z.string().min(3, 'Informe um título.').max(150),
    description: z.string().min(3, 'Descreva a campanha.').max(2000, 'Use no máximo 2000 caracteres.'),
    type: z.enum(CAMPAIGN_TYPES),
    targetBloodType: z
      .enum(BLOOD_TYPES)
      .optional()
      .or(z.literal('').transform(() => undefined)),
    // Importante: o literal('') vem ANTES de string().optional() no `.or()` -
    // z.string() aceita '' como string válida, então se a ordem fosse
    // invertida o campo vazio nunca cairia no branch que vira `undefined`
    // (visto em campaigns/schemas.test.ts).
    collectionUnitId: z
      .literal('')
      .transform(() => undefined)
      .or(z.string().optional()),
    startDate: z.string().min(1, 'Informe a data de início.'),
    endDate: z.string().min(1, 'Informe a data de fim.'),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'A data de fim deve ser igual ou posterior à data de início.',
    path: ['endDate'],
  })
  // Mesma regra do backend: uma campanha que já terminou não apareceria para ninguém.
  .refine((data) => !data.endDate || data.endDate >= businessDate(), {
    message: 'A data de fim não pode estar no passado.',
    path: ['endDate'],
  })
  // Tipo sanguíneo opcional nas duas categorias: em branco, a campanha vale para todos os tipos.
  .transform(({ targetBloodType, ...rest }) => ({
    ...rest,
    ...(targetBloodType && { targetBloodType }),
  }))

export type CreateCampaignFormValues = z.infer<typeof createCampaignSchema>
