import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/features/auth/api/auth.api'
import * as http from '@/shared/api/http'
import { useAuthStore } from '@/shared/session/auth.store'
import { VerifyEmailPage } from './VerifyEmailPage'

vi.mock('@/features/auth/api/auth.api')
vi.mock('@/shared/api/http', async (original) => ({
  ...(await original<typeof import('@/shared/api/http')>()),
  renewSession: vi.fn(),
}))

function renderAt(url: string) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <VerifyEmailPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useAuthStore.getState().clear()
  })

  it('só confirma no clique; sem sessão, não tenta renová-la', async () => {
    vi.mocked(api.verifyEmail).mockResolvedValue({ email: 'ana@example.com', changed: false })
    renderAt('/verify-email?token=abc.def')
    expect(api.verifyEmail).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar meu e-mail' }))

    expect(api.verifyEmail).toHaveBeenCalledWith('abc.def')
    expect(await screen.findByText('Pronto: o e-mail ana@example.com está confirmado.')).toBeInTheDocument()
    expect(http.renewSession).not.toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Entrar no sistema' })).toHaveAttribute('href', '/login')
  })

  it('numa troca com sessão aberta, mostra o e-mail novo e renova a sessão', async () => {
    vi.mocked(api.verifyEmail).mockResolvedValue({ email: 'nova@example.com', changed: true })
    vi.mocked(http.renewSession).mockResolvedValue('token')
    useAuthStore.getState().setSession({
      accessToken: 'x',
      user: {
        id: 'u1',
        email: 'ana@example.com',
        name: 'Ana',
        role: 'donor',
        donorId: 'd1',
        active: true,
        emailVerified: true,
        pendingEmail: 'nova@example.com',
      },
    })
    renderAt('/verify-email?token=abc.def')

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar meu e-mail' }))

    expect(await screen.findByText(/o e-mail da sua conta agora é nova@example.com/)).toBeInTheDocument()
    expect(http.renewSession).toHaveBeenCalled()
  })

  it('sem token, avisa que o link é inválido', () => {
    renderAt('/verify-email')

    expect(screen.getByText(/Link inválido/)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
