import { Button } from '@/shared/ui/Button'
import { ConfirmBox } from '@/shared/ui/ConfirmBox'

interface ConfirmPromptProps {
  /** Pergunta (ex.: "Cancelar este agendamento?"). */
  question: string
  /** Texto do botão que executa de fato (ex.: "Confirmar cancelamento"). */
  confirmLabel: string
  onConfirm: () => void
  /** "Voltar": fecha a pergunta sem fazer nada. */
  onCancel: () => void
  loading?: boolean
}

/**
 * Caixa de confirmação pronta (pergunta + confirmar + Voltar). Nas listas, fica numa linha própria,
 * com a largura do cartão, abaixo do conteúdo: assim não aperta o texto ao lado dos botões.
 */
export function ConfirmPrompt({ question, confirmLabel, onConfirm, onCancel, loading }: ConfirmPromptProps) {
  return (
    <ConfirmBox question={question}>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="danger" loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button variant="ghost" disabled={loading} onClick={onCancel}>
          Voltar
        </Button>
      </div>
    </ConfirmBox>
  )
}
