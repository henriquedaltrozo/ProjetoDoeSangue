import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/features/notifications/api/notifications.api'
import { AdminNotificationsPage } from './AdminNotificationsPage'

vi.mock('@/features/notifications/api/notifications.api')

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AdminNotificationsPage />
    </QueryClientProvider>,
  )
}

describe('AdminNotificationsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(api.listFailedJobs).mockResolvedValue([
      {
        id: '42',
        type: 'reminder-24h',
        failedReason: 'Connection timeout',
        attemptsMade: 10,
        failedAt: '2026-11-08T12:00:00.000Z',
      },
    ])
    vi.mocked(api.listSuppressed).mockResolvedValue([
      { email: 'errado@example.com', reason: 'hard_bounce', createdAt: '2026-11-08T12:00:00.000Z' },
    ])
    vi.mocked(api.listSent).mockResolvedValue({
      items: [
        {
          id: 's1',
          type: 'appointment-canceled',
          recipient: 'fu***@example.com',
          subject: 'Agendamento cancelado: 10/10/2026 às 10:00',
          status: 'SENT',
          error: null,
          jobId: 'j1',
          sentAt: '2026-11-08T12:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 50,
    })
    vi.mocked(api.retryFailedJob).mockResolvedValue(undefined)
    vi.mocked(api.unblockRecipient).mockResolvedValue(undefined)
  })

  it('mostra falhas, bloqueios e envios com nomes em português', async () => {
    renderPage()

    expect(await screen.findByText('Connection timeout')).toBeInTheDocument()
    expect(screen.getByText('Lembrete')).toBeInTheDocument()
    expect(await screen.findByText('errado@example.com')).toBeInTheDocument()
    expect(screen.getByText(/endereço inexistente/)).toBeInTheDocument()
    expect(await screen.findByText('Agendamento cancelado')).toBeInTheDocument()
    expect(screen.getByText('Enviado')).toBeInTheDocument()
  })

  it('reenvia uma falha e desbloqueia um endereço', async () => {
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Reenviar' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Desbloquear' }))

    expect(api.retryFailedJob).toHaveBeenCalledWith('42')
    expect(api.unblockRecipient).toHaveBeenCalledWith('errado@example.com')
  })

  it('o filtro de situação refaz a busca', async () => {
    renderPage()
    await screen.findByText('Agendamento cancelado')

    await userEvent.selectOptions(screen.getByLabelText('Situação'), 'FAILURE')

    expect(api.listSent).toHaveBeenLastCalledWith(1, 'FAILURE')
  })
})
