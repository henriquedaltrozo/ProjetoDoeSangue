import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosResponse } from 'axios'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schedulingApi from '@/features/scheduling/api/scheduling.api'
import { ConfirmAttendancePage } from './ConfirmAttendancePage'

vi.mock('@/features/scheduling/api/scheduling.api')

function renderPage(url: string) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <ConfirmAttendancePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function apiError(status: number, message: string) {
  const error = new AxiosError('failed')
  error.response = { status, data: { statusCode: status, message } } as AxiosResponse
  return error
}

describe('ConfirmAttendancePage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  // O Vitest está sem `globals`, então o Testing Library não limpa o DOM sozinho entre os testes.
  afterEach(() => {
    cleanup()
  })

  it('mostra um erro e não oferece o botão quando o link não traz token', () => {
    renderPage('/confirm-attendance')

    expect(screen.getByRole('alert')).toHaveTextContent(/link de confirmação inválido/i)
    expect(screen.queryByRole('button', { name: /confirmar minha presença/i })).not.toBeInTheDocument()
  })

  it('não confirma ao abrir a página, só ao clicar no botão', () => {
    renderPage('/confirm-attendance?token=abc.def')

    expect(screen.getByRole('button', { name: /confirmar minha presença/i })).toBeInTheDocument()
    expect(schedulingApi.confirmAttendanceByToken).not.toHaveBeenCalled()
  })

  it('confirma com o token do link e mostra a mensagem de sucesso', async () => {
    vi.mocked(schedulingApi.confirmAttendanceByToken).mockResolvedValue({
      id: 'appointment-1',
      dateTime: '2026-10-10T13:00:00.000Z',
      status: 'CONFIRMED',
      confirmedAt: '2026-10-08T12:00:00.000Z',
    })
    renderPage('/confirm-attendance?token=abc.def')

    await userEvent.click(screen.getByRole('button', { name: /confirmar minha presença/i }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/presença confirmada/i))
    // O TanStack Query v5 passa um segundo argumento (contexto da mutation) ao mutationFn.
    expect(vi.mocked(schedulingApi.confirmAttendanceByToken).mock.calls[0][0]).toBe('abc.def')
    expect(screen.queryByRole('button', { name: /confirmar minha presença/i })).not.toBeInTheDocument()
  })

  it('mostra a mensagem da API quando o link expirou e permite tentar de novo', async () => {
    vi.mocked(schedulingApi.confirmAttendanceByToken).mockRejectedValue(
      apiError(410, 'Este link de confirmação expirou.'),
    )
    renderPage('/confirm-attendance?token=abc.def')

    await userEvent.click(screen.getByRole('button', { name: /confirmar minha presença/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/link de confirmação expirou/i))
    expect(screen.getByRole('button', { name: /confirmar minha presença/i })).toBeInTheDocument()
  })
})
