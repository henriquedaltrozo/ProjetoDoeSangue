import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmButton } from './ConfirmButton'

function renderButton(onConfirm = vi.fn()) {
  render(
    <ConfirmButton question="Desativar esta campanha?" confirmLabel="Confirmar desativação" onConfirm={onConfirm}>
      Desativar
    </ConfirmButton>,
  )
  return onConfirm
}

describe('ConfirmButton', () => {
  it('o primeiro clique só pergunta, sem executar a ação', async () => {
    const onConfirm = renderButton()

    await userEvent.click(screen.getByRole('button', { name: 'Desativar' }))

    expect(screen.getByText('Desativar esta campanha?')).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('executa a ação ao confirmar', async () => {
    const onConfirm = renderButton()

    await userEvent.click(screen.getByRole('button', { name: 'Desativar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar desativação' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('voltar volta ao botão inicial sem executar', async () => {
    const onConfirm = renderButton()

    await userEvent.click(screen.getByRole('button', { name: 'Desativar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }))

    expect(screen.getByRole('button', { name: 'Desativar' })).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('com validate falso, não pergunta (quem chamou mostra o erro no campo)', async () => {
    const validate = vi.fn().mockReturnValue(false)
    render(
      <ConfirmButton question="Registrar?" confirmLabel="Confirmar" onConfirm={vi.fn()} validate={validate}>
        Registrar
      </ConfirmButton>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Registrar' }))

    expect(validate).toHaveBeenCalledOnce()
    expect(screen.queryByText('Registrar?')).not.toBeInTheDocument()
  })
})
