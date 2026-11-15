import { useResendVerification } from '@/features/auth/hooks/useAuth'
import { useAuthStore } from '@/shared/session/auth.store'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { ErrorAlert } from '@/shared/ui/ErrorAlert'

/**
 * Aviso no topo das telas do doador enquanto falta confirmar um e-mail: o do cadastro (sem ele, não
 * agenda) ou o novo, pedido em Meu perfil. Oferece reenviar o link.
 */
export function EmailVerificationBanner() {
  const user = useAuthStore((s) => s.user)
  const resend = useResendVerification()

  if (user?.role !== 'donor') return null
  const pending = user.pendingEmail ?? null
  // `=== false`: uma sessão salva antes deste campo existir não mostra o aviso à toa.
  if (!pending && user.emailVerified !== false) return null

  return (
    <div className="mb-6">
      <Alert variant="warning" title={pending ? 'Confirme o seu novo e-mail' : 'Confirme o seu e-mail'}>
        <p>
          {pending ? (
            <>
              Enviamos um link para <strong>{pending}</strong>. Até você abrir esse link, a conta continua com o e-mail{' '}
              {user.email}.
            </>
          ) : (
            <>
              Enviamos um link para <strong>{user.email}</strong>. Abra esse link para poder agendar suas doações.
            </>
          )}
        </p>
        {resend.isSuccess ? (
          <p className="font-medium">
            {resend.data.sentTo ? `Link reenviado para ${resend.data.sentTo}.` : 'Seu e-mail já está confirmado.'}
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button variant="secondary" loading={resend.isPending} onClick={() => resend.mutate()}>
              Reenviar link
            </Button>
            <span className="text-xs">Não achou? Veja também a caixa de spam.</span>
          </div>
        )}
        <ErrorAlert
          error={resend.error}
          fallback="Não foi possível reenviar o link. Tente de novo em alguns minutos."
        />
      </Alert>
    </div>
  )
}
