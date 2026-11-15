import { extractErrorMessage } from '@/shared/api/http'
import { Alert } from '@/shared/ui/Alert'

/** Alerta de erro da API; não renderiza nada quando `error` é nulo (mutation/query sem falha). */
export function ErrorAlert({
  error,
  fallback,
  className,
}: {
  error: unknown
  fallback?: string
  /** Quando informado, envolve o alerta numa div com essa classe (ex.: margem inferior). */
  className?: string
}) {
  if (!error) {
    return null
  }
  const alert = <Alert variant="error">{extractErrorMessage(error, fallback)}</Alert>
  return className ? <div className={className}>{alert}</div> : alert
}
