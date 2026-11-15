import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/features/auth/api/auth.api'
import { useAuthStore } from '@/shared/session/auth.store'
import type { UserResponseDto } from '@/shared/types'
import { EmailVerificationBanner } from './EmailVerificationBanner'

vi.mock('@/features/auth/api/auth.api')

const donor = (partial: Partial<UserResponseDto> = {}): UserResponseDto => ({
  id: 'u1',
  email: 'ana@example.com',
  name: 'Ana',
  role: 'donor',
  donorId: 'd1',
  active: true,
  emailVerified: true,
  pendingEmail: null,
  ...partial,
})

function renderAs(user: UserResponseDto) {
  useAuthStore.getState().setSession({ accessToken: 'x', user })
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <EmailVerificationBanner />
    </QueryClientProvider>,
  )
}

describe('EmailVerificationBanner', () => {
  beforeEach(() => vi.resetAllMocks())

  it('não aparece com o e-mail confirmado e sem troca pendente', () => {
    const { container } = renderAs(donor())
    expect(container).toBeEmptyDOMElement()
  })

  it('não aparece para admin', () => {
    const { container } = renderAs(donor({ role: 'admin', donorId: null, emailVerified: false }))
    expect(container).toBeEmptyDOMElement()
  })

  it('e-mail do cadastro não confirmado: avisa e reenvia o link', async () => {
    vi.mocked(api.resendVerification).mockResolvedValue({ sentTo: 'ana@example.com' })
    renderAs(donor({ emailVerified: false }))

    expect(screen.getByText('Confirme o seu e-mail')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reenviar link' }))

    expect(api.resendVerification).toHaveBeenCalled()
    expect(await screen.findByText('Link reenviado para ana@example.com.')).toBeInTheDocument()
  })

  it('troca pendente: mostra o e-mail novo e diz que o atual continua valendo', () => {
    renderAs(donor({ pendingEmail: 'nova@example.com' }))

    expect(screen.getByText('Confirme o seu novo e-mail')).toBeInTheDocument()
    expect(screen.getByText('nova@example.com')).toBeInTheDocument()
    expect(screen.getByText(/continua com o e-mail ana@example.com/)).toBeInTheDocument()
  })
})
