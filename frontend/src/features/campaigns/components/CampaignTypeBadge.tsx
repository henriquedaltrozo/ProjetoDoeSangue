import { CAMPAIGN_TYPE_LABEL, type CampaignType } from '@/shared/types'
import { Badge } from '@/shared/ui/Badge'

/** Tipo da campanha: urgente em vermelho, regular em cinza. Igual para doador e admin. */
export function CampaignTypeBadge({ type }: { type: CampaignType }) {
  return <Badge tone={type === 'URGENT' ? 'danger' : 'neutral'}>{CAMPAIGN_TYPE_LABEL[type]}</Badge>
}
