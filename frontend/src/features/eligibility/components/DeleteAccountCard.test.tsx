import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDeleteMyAccount } from '@/features/auth'
import { DeleteAccountCard } from './DeleteAccountCard'

vi.mock('@/features/auth', () => ({ useDeleteMyAccount: vi.fn() }))

const mutate = vi.fn()

function renderCard() {
  return render(
    <MemoryRouter>
      <DeleteAccountCard />
    </MemoryRouter>,
  )
}

describe('DeleteAccountCard', () => {
  beforeEach(() => {
    mutate.mockReset()
    vi.mocked(useDeleteMyAccount).mockReturnValue({
      mutate,
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof useDeleteMyAccount>)
  })

  it('sem a senha, não pergunta nem exclui: mostra o erro no campo', async () => {
    renderCard()

    await userEvent.click(screen.getByRole('button', { name: 'Excluir minha conta' }))

    expect(screen.getByText('Informe sua senha atual para excluir a conta.')).toBeInTheDocument()
    expect(screen.queryByText('Tem certeza? Essa ação é permanente.')).not.toBeInTheDocument()
    expect(mutate).not.toHaveBeenCalled()
  })

  it('com a senha, confirma e envia a senha atual', async () => {
    renderCard()

    await userEvent.type(screen.getByLabelText('Sua senha atual'), 'minha-senha')
    await userEvent.click(screen.getByRole('button', { name: 'Excluir minha conta' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sim, excluir meus dados' }))

    expect(mutate).toHaveBeenCalledWith('minha-senha')
  })
})
