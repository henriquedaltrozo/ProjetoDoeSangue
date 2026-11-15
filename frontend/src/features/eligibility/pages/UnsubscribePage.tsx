import { useMutation } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { unsubscribeAlerts } from '@/features/eligibility/api/eligibility.api'
import { usePageTitle } from '@/shared/lib/usePageTitle'
import { Alert } from '@/shared/ui/Alert'
import { AuthPageLayout } from '@/shared/ui/AuthPageLayout'
import { Button } from '@/shared/ui/Button'
import { ErrorAlert } from '@/shared/ui/ErrorAlert'

/**
 * Destino do link "não quero mais receber" dos e-mails de campanha e de "já pode doar". Pública: o
 * token assinado do link prova de quem é. Só desliga no clique (não ao abrir), para um leitor de
 * e-mail ou antivírus que "visita" o link não descadastrar o doador por conta própria.
 */
export function UnsubscribePage() {
  usePageTitle('Deixar de receber avisos')
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const unsubscribe = useMutation({ mutationFn: (value: string) => unsubscribeAlerts(value) })

  return (
    <AuthPageLayout title="Deixar de receber avisos">
      {!token && (
        <div className="mt-4 flex flex-col gap-4">
          <Alert variant="error">
            Link inválido. Use o link completo do e-mail ou desmarque a opção em Meu perfil.
          </Alert>
          <Link to="/login" className="text-sm font-medium text-red-600 hover:underline">
            Entrar no sistema
          </Link>
        </div>
      )}

      {token && !unsubscribe.isSuccess && (
        <div className="mt-4 flex flex-col gap-4">
          <p className="text-sm text-slate-500">
            Você deixa de receber os avisos de campanhas urgentes e o e-mail de quando pode doar de novo. Os e-mails
            sobre os seus agendamentos e sobre a segurança da sua conta continuam.
          </p>
          <ErrorAlert error={unsubscribe.error} fallback="Não foi possível concluir. Tente pelo Meu perfil." />
          <Button loading={unsubscribe.isPending} onClick={() => unsubscribe.mutate(token)}>
            Não quero mais receber esses avisos
          </Button>
        </div>
      )}

      {unsubscribe.isSuccess && (
        <div className="mt-4 flex flex-col gap-4">
          <Alert variant="success">Pronto: você não vai mais receber esses avisos.</Alert>
          <p className="text-sm text-slate-500">Mudou de ideia? É só marcar a opção de novo em Meu perfil.</p>
          <Link to="/profile" className="text-sm font-medium text-red-600 hover:underline">
            Ir para Meu perfil
          </Link>
        </div>
      )}
    </AuthPageLayout>
  )
}
