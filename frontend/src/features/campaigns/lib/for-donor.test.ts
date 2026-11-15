import { describe, expect, it } from 'vitest'
import type { CampaignDto } from '@/shared/types'
import { campaignsForDonor } from './for-donor'

const campaign = (id: string, type: CampaignDto['type'], targetBloodType: CampaignDto['targetBloodType']) =>
  ({ id, type, targetBloodType, active: true }) as CampaignDto

describe('campaignsForDonor', () => {
  const list = [
    campaign('regular', 'REGULAR', null),
    campaign('tipo-a', 'REGULAR', 'A+'),
    campaign('tipo-o', 'REGULAR', 'O+'),
    campaign('urgente', 'URGENT', null),
    campaign('urgente-o', 'URGENT', 'O+'),
  ]

  it('mostra as urgentes e as do tipo do doador, urgentes primeiro', () => {
    expect(campaignsForDonor(list, 'O+').map((c) => c.id)).toEqual(['urgente', 'urgente-o', 'tipo-o'])
  })

  it('sem tipo sanguíneo, só as urgentes sem tipo definido', () => {
    expect(campaignsForDonor(list, null).map((c) => c.id)).toEqual(['urgente'])
  })

  it('ignora campanhas inativas', () => {
    expect(campaignsForDonor([{ ...campaign('x', 'URGENT', null), active: false }], null)).toEqual([])
  })
})
