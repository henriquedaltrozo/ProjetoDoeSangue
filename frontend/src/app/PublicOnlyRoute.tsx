import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/shared/session/auth.store'
import { homePathFor } from '@/shared/session/homePath'

/**
 * Telas só para quem não está logado (login, cadastro, senha, admin inicial). Quem já tem sessão
 * vai para a própria tela inicial: evita, por exemplo, um admin logado preencher o cadastro de
 * doador e acabar trocando de conta sem querer.
 */
export function PublicOnlyRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)

  if (isAuthenticated && user) {
    return <Navigate to={homePathFor(user.role)} replace />
  }
  return <Outlet />
}
