import { Button } from '@/shared/ui/Button'

interface ActivationButtonProps {
  active: boolean
  onDeactivate: () => void
  onReactivate: () => void
  deactivating?: boolean
  reactivating?: boolean
  /** Impede desativar (ex.: o admin não pode desativar a própria conta). */
  deactivateDisabled?: boolean
}

/**
 * Botão "Desativar" (item ativo) ou "Reativar" (item desativado) das listas administrativas. Para
 * pedir confirmação antes de desativar, `onDeactivate` abre um `ConfirmPrompt` abaixo do item.
 */
export function ActivationButton({
  active,
  onDeactivate,
  onReactivate,
  deactivating,
  reactivating,
  deactivateDisabled,
}: ActivationButtonProps) {
  if (active) {
    return (
      <Button variant="danger" disabled={deactivateDisabled} loading={deactivating} onClick={onDeactivate}>
        Desativar
      </Button>
    )
  }
  return (
    <Button variant="secondary" loading={reactivating} onClick={onReactivate}>
      Reativar
    </Button>
  )
}
