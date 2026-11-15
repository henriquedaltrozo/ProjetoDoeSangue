import { describe, expect, it } from 'vitest'
import { addDaysISO, businessDate } from '@/shared/lib/format'
import { createCampaignSchema } from './schemas'

// Datas relativas a hoje: uma campanha não pode terminar no passado.
const today = businessDate()
const inDays = (days: number) => addDaysISO(today, days)

const base = {
  title: 'Campaign de inverno',
  description: 'Precisamos de doadores para o inverno.',
  type: 'REGULAR' as const,
  startDate: inDays(1),
  endDate: inDays(30),
}

describe('createCampaignSchema', () => {
  it('recusa uma campanha que termina no passado', () => {
    const result = createCampaignSchema.safeParse({ ...base, startDate: inDays(-10), endDate: inDays(-1) })
    expect(result.success).toBe(false)
  })

  it('aceita uma campanha regular sem tipo sanguíneo alvo', () => {
    const result = createCampaignSchema.safeParse(base)
    expect(result.success).toBe(true)
  })

  it('só aceita as categorias regular e urgente', () => {
    expect(createCampaignSchema.safeParse({ ...base, type: 'URGENT' }).success).toBe(true)
    expect(createCampaignSchema.safeParse({ ...base, type: 'SPECIFIC_BLOOD_TYPE' }).success).toBe(false)
  })

  it('rejeita quando a data de fim é anterior à data de início', () => {
    const result = createCampaignSchema.safeParse({
      ...base,
      startDate: inDays(30),
      endDate: inDays(1),
    })
    expect(result.success).toBe(false)
  })

  it('trata collectionUnitId em branco como não informado', () => {
    const result = createCampaignSchema.safeParse({ ...base, collectionUnitId: '' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.collectionUnitId).toBeUndefined()
    }
  })
})

describe('createCampaignSchema - tipo sanguíneo opcional', () => {
  it('envia o tipo sanguíneo escolhido, nas duas categorias', () => {
    expect(createCampaignSchema.parse({ ...base, type: 'URGENT', targetBloodType: 'O-' }).targetBloodType).toBe('O-')
    expect(createCampaignSchema.parse({ ...base, targetBloodType: 'A+' }).targetBloodType).toBe('A+')
  })

  it('em branco ("Todos os tipos"), não envia o tipo sanguíneo', () => {
    expect(createCampaignSchema.parse({ ...base, targetBloodType: '' })).not.toHaveProperty('targetBloodType')
  })
})
