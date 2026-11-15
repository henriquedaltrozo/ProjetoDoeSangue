import { useCampaigns } from '@/features/campaigns/hooks/useCampaigns'
import { campaignsForDonor } from '@/features/campaigns/lib/for-donor'
import { formatDate } from '@/shared/lib/format'
import type { BloodType } from '@/shared/types'
import { ButtonLink } from '@/shared/ui/ButtonLink'

/**
 * Destaque das campanhas que pedem o doador (urgentes e do tipo sanguíneo dele). Só aparece quando há
 * alguma: sem campanha (ou se a lista não carregar), não ocupa espaço; a aba Campanhas lista todas.
 */
export function CampaignsForYou({ bloodType }: { bloodType: BloodType | null }) {
  const campaigns = useCampaigns()
  const forYou = campaignsForDonor(campaigns.data, bloodType).slice(0, 3)
  if (forYou.length === 0) return null

  return (
    <section aria-label="Campanhas para você" className="flex flex-col gap-3">
      {forYou.map((c) => (
        <div
          key={c.id}
          className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
            c.type === 'URGENT' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
          }`}
        >
          <div>
            <p
              className={`text-xs font-semibold uppercase tracking-wide ${c.type === 'URGENT' ? 'text-red-700' : 'text-amber-800'}`}
            >
              {c.type === 'URGENT' ? 'Campanha urgente' : 'Campanha para o seu tipo sanguíneo'}
            </p>
            <p className="font-semibold text-slate-900">{c.title}</p>
            <p className="text-sm text-slate-600">{c.description}</p>
            <p className="mt-1 text-xs text-slate-500">
              Até {formatDate(c.endDate)}
              {c.targetBloodType && ` - Tipo sanguíneo: ${c.targetBloodType}`}
            </p>
          </div>
          <ButtonLink className="shrink-0" to={{ pathname: '/schedule', search: `?campaignId=${c.id}` }}>
            Agendar para esta campanha
          </ButtonLink>
        </div>
      ))}
    </section>
  )
}
