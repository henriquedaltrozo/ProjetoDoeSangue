import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/features/auth/api/auth.api'
import { useAuthStore } from '@/shared/session/auth.store'
import { SetupAdminPage } from './SetupAdminPage'

vi.mock('@/features/auth/api/auth.api')

function renderSetupPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/setup-admin']}>
        <SetupAdminPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SetupAdminPage', () => {
  beforeEach(() => {
    useAuthStore.getState().clear()
  })

  it('sem sessão, mostra o formulário com o token de instalação', () => {
    renderSetupPage()
    expect(screen.getByLabelText('Token de instalação')).toBeInTheDocument()
  })

  it('depois de cadastrar, limpa o formulário e mostra o aviso de sucesso', async () => {
    vi.mocked(api.registerAdmin).mockResolvedValue({} as never)
    renderSetupPage()

    await userEvent.type(screen.getByLabelText('Nome completo'), 'Admin Teste')
    await userEvent.type(screen.getByLabelText('E-mail'), 'admin@example.com')
    await userEvent.type(screen.getByLabelText('Senha'), 'senhaForte123')
    await userEvent.type(screen.getByLabelText('Confirmar senha'), 'senhaForte123')
    await userEvent.type(screen.getByLabelText('Token de instalação'), 'token')
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar admin' }))

    expect(await screen.findByText('Admin cadastrado com sucesso.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nome completo')).toHaveValue('')
  })
})
