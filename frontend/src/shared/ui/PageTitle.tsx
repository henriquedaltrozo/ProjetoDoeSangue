import type { ReactNode } from 'react'

/** Título (h1) das páginas autenticadas; `className` ajusta a margem inferior (padrão mb-6). */
export function PageTitle({ children, className = 'mb-6' }: { children: ReactNode; className?: string }) {
  return <h1 className={`${className} text-2xl font-bold text-slate-900`}>{children}</h1>
}
