import { type ReactNode, useState } from 'react'
import { Button, type ButtonVariant } from '@/shared/ui/Button'
import { ConfirmPrompt } from '@/shared/ui/ConfirmPrompt'

interface ConfirmButtonProps {
  /** Texto do botão inicial (ex.: "Desativar"). */
  children: ReactNode
  /** Pergunta exibida antes de executar (ex.: "Desativar esta campanha? Não dá para desfazer."). */
  question: string
  /** Texto do botão que executa de fato (ex.: "Confirmar desativação"). */
  confirmLabel: string
  onConfirm: () => void
  loading?: boolean
  variant?: ButtonVariant
  /**
   * Conferência antes de perguntar (ex.: o motivo foi escolhido?). Se devolver false, a pergunta
   * não aparece: quem chamou mostra o erro no campo.
   */
  validate?: () => boolean
}

/**
 * Botão para ações que não têm volta: o primeiro clique só pergunta, e a ação roda no botão
 * de confirmação. A pergunta aparece no lugar do botão; em linhas com texto ao lado (cartões de
 * lista), use `ConfirmPrompt` abaixo do conteúdo, para a caixa ter a largura do cartão.
 */
export function ConfirmButton({
  children,
  question,
  confirmLabel,
  onConfirm,
  loading,
  variant = 'danger',
  validate,
}: ConfirmButtonProps) {
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <Button
        variant={variant}
        loading={loading}
        onClick={() => {
          if (validate && !validate()) return
          setConfirming(true)
        }}
      >
        {children}
      </Button>
    )
  }

  return (
    <ConfirmPrompt
      question={question}
      confirmLabel={confirmLabel}
      loading={loading}
      onConfirm={() => {
        setConfirming(false)
        onConfirm()
      }}
      onCancel={() => setConfirming(false)}
    />
  )
}
