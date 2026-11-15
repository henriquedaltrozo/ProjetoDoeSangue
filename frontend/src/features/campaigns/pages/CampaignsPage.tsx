import { CampaignTypeBadge } from '@/features/campaigns/components/CampaignTypeBadge'
import { useCampaigns } from '@/features/campaigns/hooks/useCampaigns'
import { formatDate } from '@/shared/lib/format'
import { usePageTitle } from '@/shared/lib/usePageTitle'
import { ButtonLink } from '@/shared/ui/ButtonLink'
import { Card } from '@/shared/ui/Card'
import { ErrorAlert } from '@/shared/ui/ErrorAlert'
import { PageTitle } from '@/shared/ui/PageTitle'
import { Spinner } from '@/shared/ui/Spinner'

export function CampaignsPage() {
  usePageTitle('Campanhas')
  const campaigns = useCampaigns()

  return (
    <div>
      <PageTitle>Campanhas de doação</PageTitle>

      {campaigns.isLoading && <Spinner label="Carregando campanhas..." />}
      <ErrorAlert error={campaigns.error} fallback="Não foi possível carregar as campanhas." />

      {campaigns.data?.length === 0 && (
        <Card>
          <p className="text-slate-500">Nenhuma campanha ativa no momento. Fique de olho por aqui!</p>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {campaigns.data?.map((c) => (
          <Card key={c.id}>
            <div className="mb-1 flex items-start justify-between gap-3">
              <p className="text-lg font-semibold text-slate-900">{c.title}</p>
              <CampaignTypeBadge type={c.type} />
            </div>
            <p className="mb-3 text-sm text-slate-600">{c.description}</p>
            <p className="mb-4 text-xs text-slate-500">
              Válida de {formatDate(c.startDate)} até {formatDate(c.endDate)}
              {c.targetBloodType && ` - Tipo sanguíneo: ${c.targetBloodType}`}
            </p>
            <ButtonLink to={{ pathname: '/schedule', search: `?campaignId=${c.id}` }}>
              Agendar para esta campanha
            </ButtonLink>
          </Card>
        ))}
      </div>
    </div>
  )
}
