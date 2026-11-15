import { useUpdateProfile } from '@/features/eligibility/hooks/useEligibility'
import type { DonorResponseDto } from '@/shared/types'
import { Card } from '@/shared/ui/Card'
import { ErrorAlert } from '@/shared/ui/ErrorAlert'

/**
 * Preferência de e-mails: campanhas urgentes e "você já pode doar". Os avisos ligados a algo que o
 * doador fez (agendamento, cancelamento, senha) sempre saem. Grava ao marcar/desmarcar.
 */
export function EmailAlertsCard({ donor }: { donor: DonorResponseDto }) {
  const update = useUpdateProfile(donor.id)

  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold text-slate-900">Avisos por e-mail</h2>
      <Card className="flex flex-col gap-3">
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-1"
            checked={donor.receiveAlerts}
            disabled={update.isPending}
            onChange={(e) => update.mutate({ receiveAlerts: e.target.checked })}
          />
          <span>Quero receber avisos de campanhas urgentes e um e-mail quando eu puder doar sangue de novo.</span>
        </label>
        <p className="text-sm text-slate-500">
          Os e-mails sobre os seus agendamentos e sobre a segurança da sua conta são sempre enviados.
        </p>
        <ErrorAlert error={update.error} fallback="Não foi possível salvar a preferência." />
      </Card>
    </div>
  )
}
