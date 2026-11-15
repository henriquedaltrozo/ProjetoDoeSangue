import { Link, useSearchParams } from 'react-router-dom'
import { useVerifyEmail } from '@/features/auth/hooks/useAuth'
import { usePageTitle } from '@/shared/lib/usePageTitle'
import { useAuthStore } from '@/shared/session/auth.store'
import { homePathFor } from '@/shared/session/homePath'
import { Alert } from '@/shared/ui/Alert'
import { AuthPageLayout } from '@/shared/ui/AuthPageLayout'
import { Button } from '@/shared/ui/Button'
import { ErrorAlert } from '@/shared/ui/ErrorAlert'

/**
 * Destino do link de confirmação de e-mail (cadastro ou troca). Pública: o token assinado do link é a
 * credencial. Só confirma no clique, para um leitor de e-mail ou antivírus que "visita" o link não
 * confirmar no lugar da pessoa.
 */
export function VerifyEmailPage() {
  usePageTitle('Confirmar e-mail')
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const user = useAuthStore((s) => s.user)
  const verify = useVerifyEmail()
  const next = user ? { to: homePathFor(user.role), label: 'Continuar' } : { to: '/login', label: 'Entrar no sistema' }

  return (
    <AuthPageLayout title="Confirmar e-mail">
      {!token && (
        <div className="mt-4 flex flex-col gap-4">
          <Alert variant="error">
            Link inválido. Use o link completo do e-mail; se precisar, peça outro na página inicial do sistema.
          </Alert>
          <Link to={next.to} className="text-sm font-medium text-red-600 hover:underline">
            {next.label}
          </Link>
        </div>
      )}

      {token && !verify.isSuccess && (
        <div className="mt-4 flex flex-col gap-4">
          <p className="text-sm text-slate-500">Clique no botão para confirmar que este endereço de e-mail é seu.</p>
          <ErrorAlert error={verify.error} fallback="Não foi possível confirmar o e-mail. Tente de novo." />
          <Button loading={verify.isPending} onClick={() => verify.mutate(token)}>
            Confirmar meu e-mail
          </Button>
        </div>
      )}

      {verify.isSuccess && (
        <div className="mt-4 flex flex-col gap-4">
          <Alert variant="success">
            {verify.data.changed
              ? `Pronto: o e-mail da sua conta agora é ${verify.data.email}. Use-o para entrar.`
              : `Pronto: o e-mail ${verify.data.email} está confirmado.`}
          </Alert>
          <Link to={next.to} className="text-sm font-medium text-red-600 hover:underline">
            {next.label}
          </Link>
        </div>
      )}
    </AuthPageLayout>
  )
}
