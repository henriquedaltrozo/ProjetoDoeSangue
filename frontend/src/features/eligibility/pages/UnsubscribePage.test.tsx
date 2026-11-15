import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/features/eligibility/api/eligibility.api'
import { UnsubscribePage } from './UnsubscribePage'

vi.mock('@/features/eligibility/api/eligibility.api')

function renderAt(url: string) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <UnsubscribePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('UnsubscribePage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(api.unsubscribeAlerts).mockResolvedValue(undefined)
  })

  it('não descadastra ao abrir: só no clique, enviando o token do link', async () => {
    renderAt('/unsubscribe?token=abc.def')
    expect(api.unsubscribeAlerts).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Não quero mais receber esses avisos' }))

    expect(api.unsubscribeAlerts).toHaveBeenCalledWith('abc.def')
    expect(await screen.findByText('Pronto: você não vai mais receber esses avisos.')).toBeInTheDocument()
  })

  it('sem token, avisa que o link é inválido', () => {
    renderAt('/unsubscribe')

    expect(screen.getByText(/Link inválido/)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
