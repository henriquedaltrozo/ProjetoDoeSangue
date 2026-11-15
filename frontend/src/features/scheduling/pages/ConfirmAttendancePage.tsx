import { Link, useSearchParams } from 'react-router-dom'
import { useConfirmAttendanceByToken } from '@/features/scheduling/hooks/useScheduling'
import { formatDateTime } from '@/shared/lib/format'
import { usePageTitle } from '@/shared/lib/usePageTitle'
import { Alert } from '@/shared/ui/Alert'
import { AuthPageLayout } from '@/shared/ui/AuthPageLayout'
import { Button } from '@/shared/ui/Button'
import { ErrorAlert } from '@/shared/ui/ErrorAlert'

/**
 * Destino do link do e-mail de confirmação de presença. Pública de propósito:
 * quem prova o direito de confirmar é o token do link (assinado e com
 * validade), não a sessão - o doador costuma abrir o e-mail no celular, sem
 * estar logado.
 *
 * A confirmação só acontece no clique do botão, não ao abrir a página: assim um
 * leitor de e-mail ou antivírus que "visita" o link para inspecioná-lo não
 * confirma a presença por conta própria.
 */
export function ConfirmAttendancePage() {
  usePageTitle('Confirmar presença')
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const confirm = useConfirmAttendanceByToken()

  return (
    <AuthPageLayout title="Confirmar presença">
      {!token && (
        <div className="mt-4 flex flex-col gap-4">
          <Alert variant="error">
            Link de confirmação inválido. Use o link completo recebido por e-mail ou confirme pelo sistema.
          </Alert>
          <Link to="/login" className="text-sm font-medium text-red-600 hover:underline">
            Entrar no sistema
          </Link>
        </div>
      )}

      {token && !confirm.isSuccess && (
        <div className="mt-4 flex flex-col gap-4">
          <p className="text-sm text-slate-500">
            Confirme que você vai comparecer à sua doação de sangue. Se não puder ir, cancele o agendamento pelo sistema
            para liberar a vaga para outro doador.
          </p>
          <ErrorAlert error={confirm.error} fallback="Não foi possível confirmar sua presença." />
          <Button loading={confirm.isPending} onClick={() => confirm.mutate(token)}>
            Confirmar minha presença
          </Button>
        </div>
      )}

      {confirm.isSuccess && (
        <div className="mt-4 flex flex-col gap-4">
          <Alert variant="success">Presença confirmada para {formatDateTime(confirm.data.dateTime)}. Obrigado!</Alert>
          <Link to="/appointments" className="text-sm font-medium text-red-600 hover:underline">
            Ver meus agendamentos
          </Link>
        </div>
      )}
    </AuthPageLayout>
  )
}
