import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  loading?: boolean
}

/**
 * Quatro estilos, todos do mesmo tamanho: vermelho cheio (ação principal), contorno cinza (ação
 * secundária), contorno vermelho (ação destrutiva) e sem fundo (voltar, fechar). O contorno
 * branco funciona tanto sobre cartões quanto dentro dos avisos coloridos.
 */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'border-red-600 bg-red-600 text-white hover:border-red-700 hover:bg-red-700 focus-visible:outline-red-600',
  secondary: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-slate-400',
  danger: 'border-red-300 bg-white text-red-600 hover:bg-red-50 focus-visible:outline-red-600',
  ghost: 'border-transparent bg-transparent text-slate-700 hover:bg-slate-100 focus-visible:outline-slate-400',
}

/** Classes visuais do botão; também usadas pelo `ButtonLink` (link com cara de botão). */
export function buttonClasses(variant: ButtonVariant = 'primary', className = ''): string {
  // Borda em todos os estilos (transparente quando não aparece): assim todos ficam com a mesma altura.
  return `inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASSES[variant]} ${className}`
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  className = '',
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={buttonClasses(variant, className)} disabled={disabled || loading} {...rest}>
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  )
}
