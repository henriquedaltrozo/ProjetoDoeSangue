import { useState } from 'react'
import { RegisterAdminForm } from '@/features/auth/components/RegisterAdminForm'
import { useAdmins, useDeactivateAdmin, useReactivateAdmin } from '@/features/auth/hooks/useAuth'
import { usePageTitle } from '@/shared/lib/usePageTitle'
import { useAuthStore } from '@/shared/session/auth.store'
import { ActivationButton } from '@/shared/ui/ActivationButton'
import { Card } from '@/shared/ui/Card'
import { ConfirmPrompt } from '@/shared/ui/ConfirmPrompt'
import { ErrorAlert } from '@/shared/ui/ErrorAlert'
import { PageTitle } from '@/shared/ui/PageTitle'
import { Spinner } from '@/shared/ui/Spinner'

/** [admin] Cadastro e gestão (desativar/reativar) de outros admins. */
export function AdminsPage() {
  usePageTitle('Admins')
  const loggedInUser = useAuthStore((s) => s.user)
  const admins = useAdmins()
  const deactivate = useDeactivateAdmin()
  const reactivate = useReactivateAdmin()

  const managementError = deactivate.error ?? reactivate.error
  // Admin cuja desativação está sendo confirmada (a pergunta aparece embaixo do cartão dele).
  const [askingId, setAskingId] = useState<string | null>(null)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        <PageTitle className="mb-4">Cadastrar novo admin</PageTitle>
        <Card>
          <RegisterAdminForm />
        </Card>
      </div>

      <div>
        <h2 className="mb-4 text-2xl font-bold text-slate-900">Admins cadastrados</h2>
        <ErrorAlert error={admins.error} fallback="Não foi possível carregar os admins." className="mb-4" />
        <ErrorAlert error={managementError} fallback="Não foi possível alterar o admin." className="mb-4" />
        {admins.isLoading && <Spinner label="Carregando admins..." />}
        <div className="flex flex-col gap-3">
          {admins.data?.map((a) => {
            const isYourself = a.id === loggedInUser?.id
            return (
              <Card key={a.id} className={`flex flex-col gap-3 ${!a.active ? 'opacity-60' : ''}`}>
                {/* No celular o botão vai para baixo do texto; a partir do tablet, fica à direita. */}
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1 break-words">
                    <p className="font-medium text-slate-900">
                      {a.name} {isYourself && <span className="text-xs font-normal text-slate-400">(você)</span>}
                      {!a.active && <span className="text-xs font-normal text-slate-400"> (desativado)</span>}
                    </p>
                    <p className="text-sm text-slate-500">{a.email}</p>
                  </div>
                  <ActivationButton
                    active={a.active}
                    deactivateDisabled={isYourself}
                    deactivating={deactivate.isPending && deactivate.variables === a.id}
                    reactivating={reactivate.isPending && reactivate.variables === a.id}
                    onDeactivate={() => setAskingId(askingId === a.id ? null : a.id)}
                    onReactivate={() => {
                      deactivate.reset()
                      reactivate.mutate(a.id)
                    }}
                  />
                </div>
                {askingId === a.id && (
                  <ConfirmPrompt
                    question="Desativar este admin? Ele perde o acesso na hora (inclusive sessões abertas) até ser reativado."
                    confirmLabel="Confirmar desativação"
                    onConfirm={() => {
                      setAskingId(null)
                      reactivate.reset()
                      deactivate.mutate(a.id)
                    }}
                    onCancel={() => setAskingId(null)}
                  />
                )}
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
