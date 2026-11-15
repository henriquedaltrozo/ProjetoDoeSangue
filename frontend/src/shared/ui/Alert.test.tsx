import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Alert } from './Alert'

describe('Alert', () => {
  it('sem onClose, não mostra o botão de fechar', () => {
    render(<Alert variant="success">Salvo.</Alert>)
    expect(screen.queryByRole('button', { name: 'Fechar aviso' })).not.toBeInTheDocument()
  })

  it('com onClose, o "×" chama a função', async () => {
    const onClose = vi.fn()
    render(
      <Alert variant="success" onClose={onClose}>
        Salvo.
      </Alert>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
