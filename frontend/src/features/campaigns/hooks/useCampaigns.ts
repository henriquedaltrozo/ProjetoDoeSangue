import { useQuery } from '@tanstack/react-query'
import * as campaignsApi from '@/features/campaigns/api/campaigns.api'
import { QUERY_KEYS } from '@/shared/api/queryKeys'
import { useInvalidatingMutation } from '@/shared/api/useInvalidatingMutation'

export function useCampaigns() {
  return useQuery({ queryKey: QUERY_KEYS.campaigns, queryFn: campaignsApi.listCampaigns })
}

export function useCreateCampaign() {
  return useInvalidatingMutation(campaignsApi.createCampaign, [QUERY_KEYS.campaigns])
}

export function useDeactivateCampaign() {
  return useInvalidatingMutation(campaignsApi.deactivateCampaign, [QUERY_KEYS.campaigns])
}
