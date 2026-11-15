import type { ReactNode } from 'react'

/**
 * Selo de situação (status do agendamento, tipo de campanha, "menor de 18"). Mesmo formato e mesma
 * intensidade de cor em todas as telas: fundo claro (100) e texto escuro (800).
 */
export type BadgeTone = 'neutral' | 'muted' | 'success' | 'warning' | 'danger' | 'info' | 'done'

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  muted: 'bg-slate-100 text-slate-500',
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-sky-100 text-sky-800',
  done: 'bg-violet-100 text-violet-800',
}

export function Badge({
  tone = 'neutral',
  className = '',
  title,
  children,
}: {
  tone?: BadgeTone
  className?: string
  /** Explicação ao passar o mouse. */
  title?: string
  children: ReactNode
}) {
  return (
    <span
      title={title}
      className={`inline-block shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  )
}
