import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/shared/session/auth.store'
import { homePathFor } from '@/shared/session/homePath'
import type { Role } from '@/shared/types'

/** Exige sessão ativa; se `allow` for informado, também exige um dos papéis listados. */
export function ProtectedRoute({ allow }: { allow?: Role[] }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  if (allow && user && !allow.includes(user.role)) {
    return <Navigate to={homePathFor(user.role)} replace />
  }
  return <Outlet />
}
