import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { ErrorBoundary } from '@/app/ErrorBoundary'
import { EmailVerificationBanner, useLogout } from '@/features/auth'
import { useAuthStore } from '@/shared/session/auth.store'
import { homePathFor } from '@/shared/session/homePath'
import type { Role } from '@/shared/types'
import { Button } from '@/shared/ui/Button'
import { Logo } from '@/shared/ui/Logo'

interface NavItem {
  to: string
  label: string
  /** Só marca como ativo na rota exata (ex.: "/admin" não fica ativo em "/admin/units"). */
  end?: boolean
}

const NAV_ITEMS: Record<Role, NavItem[]> = {
  donor: [
    { to: '/appointments', label: 'Meus agendamentos' },
    { to: '/schedule', label: 'Agendar doação' },
    { to: '/campaigns', label: 'Campanhas' },
  ],
  admin: [
    { to: '/admin', label: 'Agendamentos', end: true },
    { to: '/admin/donors', label: 'Doadores' },
    { to: '/admin/units', label: 'Unidades de coleta' },
    { to: '/admin/campaigns', label: 'Campanhas' },
    { to: '/admin/notifications', label: 'E-mails' },
    { to: '/admin/admins', label: 'Admins' },
  ],
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-red-50 text-red-700' : 'text-slate-600 hover:bg-slate-100'
  }`

/** Botão com o nome do usuário que abre o menu da conta (Meu perfil, Sair). Fecha com Esc ou clique fora. */
function AccountMenu({ name, isDonor, onLogout }: { name: string; isDonor: boolean; onLogout: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const itemClass = 'block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menu da conta de ${name}`}
        onClick={() => setOpen((value) => !value)}
        className="-mr-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 font-semibold text-red-700"
        >
          {name.trim().charAt(0).toUpperCase() || '?'}
        </span>
        <span className="hidden max-w-40 truncate sm:inline">{name}</span>
        <span aria-hidden="true" className="text-xs text-slate-400">
          ▾
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-2 w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
        >
          <p className="truncate px-3 py-2 text-xs text-slate-500 sm:hidden">{name}</p>
          {isDonor && (
            <Link role="menuitem" to="/profile" className={itemClass} onClick={() => setOpen(false)}>
              Meu perfil
            </Link>
          )}
          <button type="button" role="menuitem" className={itemClass} onClick={onLogout}>
            Sair
          </button>
        </div>
      )}
    </div>
  )
}

export function AppLayout() {
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  // Fecha o menu do celular ao trocar de página, inclusive por um link fora dele.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a troca de página é o gatilho.
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])
  const items = user ? NAV_ITEMS[user.role] : []

  const links = items.map((item) => (
    <NavLink key={item.to} to={item.to} end={item.end} className={linkClass} onClick={() => setMenuOpen(false)}>
      {item.label}
    </NavLink>
  ))

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        {/* Logo, links e conta com o mesmo espaço entre eles (justify-between): os links ficam a igual
            distância do logo e do nome. Em telas estreitas os links vão para o "Menu". */}
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link to={user ? homePathFor(user.role) : '/'} className="shrink-0 text-lg" aria-label="DoeSangue - início">
            <Logo />
          </Link>
          <nav aria-label="Menu principal" className="hidden items-center gap-1 lg:flex">
            {links}
          </nav>
          <div className="flex items-center gap-3">
            <AccountMenu name={user?.name ?? ''} isDonor={user?.role === 'donor'} onLogout={logout} />
            {/* Telas estreitas (celular/tablet): os links ficam num menu que abre abaixo da barra. */}
            {items.length > 0 && (
              <Button
                variant="secondary"
                className="lg:hidden"
                aria-expanded={menuOpen}
                aria-controls="menu-mobile"
                onClick={() => setMenuOpen((open) => !open)}
              >
                Menu
              </Button>
            )}
          </div>
        </div>
        {menuOpen && items.length > 0 && (
          <nav
            id="menu-mobile"
            aria-label="Menu principal"
            className="mx-auto flex max-w-5xl flex-col gap-1 border-t border-slate-100 px-4 py-3 lg:hidden"
          >
            {links}
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* Um erro numa página não derruba o menu; trocar de rota recria a barreira e limpa o erro. */}
        <EmailVerificationBanner />
        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  )
}
