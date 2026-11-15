import type { ReactNode } from 'react'

/**
 * Caixa vermelha de confirmação para ações que não têm volta (excluir, cancelar, desativar): a
 * pergunta e, embaixo, o que a ação precisa (campos e botões). Usada por todas as confirmações.
 * A pergunta e os botões ficam centralizados na caixa; campos (ex.: motivo) ocupam a largura toda.
 */
export function ConfirmBox({ question, children }: { question: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
      <p className="text-center text-sm font-medium text-red-800">{question}</p>
      {children}
    </div>
  )
}
