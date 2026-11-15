import type { ReactNode } from 'react'

/**
 * Avisos do sistema, sempre neste componente e em três cores: verde (deu certo), amarelo (atenção) e
 * vermelho (erro). Mesma borda, fundo, espaçamento e tamanho de texto em todas as telas.
 */
type AlertVariant = 'error' | 'success' | 'warning'

const VARIANT_CLASSES: Record<AlertVariant, string> = {
  error: 'bg-red-50 text-red-800 border-red-200',
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  warning: 'bg-amber-50 text-amber-900 border-amber-200',
}

interface AlertProps {
  variant?: AlertVariant
  /** Título em destaque (ex.: "Você pode doar hoje"); o resto vai em `children`. */
  title?: ReactNode
  children?: ReactNode
  /** Mostra o botão "×" para fechar o aviso. */
  onClose?: () => void
}

export function Alert({ variant = 'warning', title, children, onClose }: AlertProps) {
  return (
    // Erro é anunciado na hora pelo leitor de tela (alert); sucesso e atenção, sem interromper (status).
    <div
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${VARIANT_CLASSES[variant]}`}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="text-base font-semibold">{title}</p>}
        {children}
      </div>
      {onClose && (
        <button
          type="button"
          aria-label="Fechar aviso"
          onClick={onClose}
          className="-my-1 -mr-1 rounded px-1.5 text-lg leading-none opacity-70 hover:opacity-100"
        >
          ×
        </button>
      )}
    </div>
  )
}
