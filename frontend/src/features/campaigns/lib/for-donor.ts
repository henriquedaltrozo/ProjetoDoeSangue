import type { BloodType, CampaignDto } from '@/shared/types'

/**
 * Campanhas que pedem o doador: as urgentes e as do tipo sanguíneo dele (urgentes primeiro). Sem tipo
 * sanguíneo informado, só as urgentes sem tipo definido.
 */
export function campaignsForDonor(campaigns: CampaignDto[] | undefined, bloodType: BloodType | null): CampaignDto[] {
  return (campaigns ?? [])
    .filter((c) => c.active)
    .filter((c) => (c.targetBloodType ? c.targetBloodType === bloodType : c.type === 'URGENT'))
    .sort((a, b) => Number(b.type === 'URGENT') - Number(a.type === 'URGENT'))
}
