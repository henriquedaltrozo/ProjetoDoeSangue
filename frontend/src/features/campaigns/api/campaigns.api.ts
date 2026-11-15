import { http } from '@/shared/api/http'
import type { BloodType, CampaignDto, CampaignType } from '@/shared/types'

export async function listCampaigns(): Promise<CampaignDto[]> {
  const { data } = await http.get<CampaignDto[]>('/campaigns')
  return data
}

export interface CreateCampaignPayload {
  title: string
  description: string
  type: CampaignType
  targetBloodType?: BloodType
  collectionUnitId?: string
  startDate: string
  endDate: string
}

export async function createCampaign(payload: CreateCampaignPayload): Promise<CampaignDto> {
  const { data } = await http.post<CampaignDto>('/campaigns', payload)
  return data
}

export async function deactivateCampaign(id: string): Promise<CampaignDto> {
  const { data } = await http.delete<CampaignDto>(`/campaigns/${id}`)
  return data
}
