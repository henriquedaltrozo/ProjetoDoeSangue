import type { ReactNode } from 'react'
import { Card } from '@/shared/ui/Card'

interface AuthPageLayoutProps {
  title: ReactNode
  subtitle?: string
  /** Largura do cartão: `sm` (padrão) ou `lg` (formulários maiores, como o cadastro). */
  size?: 'sm' | 'lg'
  children: ReactNode
}

const SIZE_CLASSES = {
  // Espaço em cima e embaixo: com o celular deitado, o cartão não encosta na borda da tela.
  sm: { wrapper: 'py-8', card: 'max-w-sm' },
  lg: { wrapper: 'py-10', card: 'max-w-lg' },
}

/** Casca das páginas públicas (login, cadastro, redefinição de senha, confirmação de presença). */
export function AuthPageLayout({ title, subtitle, size = 'sm', children }: AuthPageLayoutProps) {
  const classes = SIZE_CLASSES[size]
  return (
    <div className={`flex min-h-screen items-center justify-center bg-slate-50 px-4 ${classes.wrapper}`}>
      <Card className={`w-full ${classes.card}`}>
        <h1 className="mb-1 text-xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mb-6 text-sm text-slate-500">{subtitle}</p>}
        {children}
      </Card>
    </div>
  )
}
