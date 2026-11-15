import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as schedulingApi from '@/features/scheduling/api/scheduling.api'
import type { AppointmentCreatedDto, AppointmentDto, CollectionUnitDto } from '@/shared/types'
import { MyAppointmentsPage } from './MyAppointmentsPage'

vi.mock('@/features/scheduling/api/scheduling.api')
// As campanhas para o doador têm testes próprios; aqui só a lista de agendamentos.
vi.mock('@/features/eligibility', () => ({ useMyProfile: () => ({ data: undefined }) }))
vi.mock('@/features/campaigns', () => ({ CampaignsForYou: () => null }))

const appointment: AppointmentDto = {
  id: 'appointment-1',
  donorId: 'donor-1',
  collectionUnitId: 'unit-removida',
  campaignId: null,
  dateTime: '2026-11-10T12:00:00.000Z',
  status: 'ELIGIBILITY_CONFIRMED',
  assessmentEligibilityId: 'assessment-1',
  eligibilityNotices: [],
  cancellationReason: null,
  confirmedAt: null,
  checkinAt: null,
  completedAt: null,
  createdAt: '2026-10-29T12:00:00.000Z',
  updatedAt: '2026-10-29T12:00:00.000Z',
}

const created: AppointmentCreatedDto = {
  ...appointment,
  eligibilityAssessment: {
    id: 'assessment-1',
    donorId: 'donor-1',
    appointmentId: 'appointment-1',
    result: 'ELIGIBLE',
    reasons: [],
    notices: [],
    nextEligibilityDate: null,
    origin: 'APPOINTMENT_VALIDATION',
    assessedAt: '2026-10-29T12:00:00.000Z',
  },
}

/** Mostra o estado atual do histórico, para conferir que a página o limpou. */
function HistoryState() {
  const location = useLocation()
  return <output data-testid="history-state">{JSON.stringify(location.state)}</output>
}

function renderPage(state: unknown) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[{ pathname: '/appointments', state }]}>
        <Routes>
          <Route
            path="/appointments"
            element={
              <>
                <MyAppointmentsPage />
                <HistoryState />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('MyAppointmentsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(schedulingApi.myAppointments).mockResolvedValue([appointment])
    vi.mocked(schedulingApi.listUnits).mockResolvedValue([
      { id: 'unit-1', name: 'Hemocentro Centro' } as CollectionUnitDto,
    ])
  })

  it('mostra o resultado do agendamento recém-criado e o tira do histórico do navegador', async () => {
    renderPage({ createdAppointment: created })

    expect(await screen.findByText(/Resultado da avaliação de elegibilidade/)).toBeInTheDocument()
    // Fora do histórico: recarregar a página ou voltar a ela não mostra o aviso de novo.
    expect(screen.getByTestId('history-state')).toHaveTextContent('null')
  })

  it('não mostra o aviso quando a página é aberta sem um agendamento recém-criado', async () => {
    renderPage(null)

    expect(await screen.findByText('Meus agendamentos')).toBeInTheDocument()
    expect(screen.queryByText(/Resultado da avaliação de elegibilidade/)).not.toBeInTheDocument()
  })

  it('mostra o agendamento em aberto antes do histórico e esconde "Agendar nova doação"', async () => {
    const day = 24 * 60 * 60 * 1000
    const canceled = (id: string, offsetDays: number): AppointmentDto => ({
      ...appointment,
      id,
      status: 'CANCELED',
      // Cancelados depois do ativo, mas para datas mais à frente: antes ficavam por cima dele.
      dateTime: new Date(Date.now() + offsetDays * day).toISOString(),
    })
    const active = { ...appointment, id: 'ativo', dateTime: new Date(Date.now() + 2 * day).toISOString() }
    vi.mocked(schedulingApi.myAppointments).mockResolvedValue([
      canceled('c1', 5),
      canceled('c2', 7),
      active,
      canceled('c3', 3),
    ])
    renderPage(null)

    const openSection = await screen.findByRole('region', { name: 'Em aberto' })
    expect(within(openSection).getByText('Cancelar')).toBeInTheDocument()
    // Histórico fechado até clicar no botão.
    const historySection = screen.getByRole('region', { name: 'Histórico' })
    expect(within(historySection).queryByText('Cancelado')).not.toBeInTheDocument()
    await userEvent.click(within(historySection).getByRole('button', { name: 'Ver histórico (3)' }))
    expect(within(historySection).getAllByText('Cancelado')).toHaveLength(3)
    expect(within(historySection).getByRole('button', { name: 'Ocultar histórico' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Agendar nova doação' })).not.toBeInTheDocument()
  })

  it('mostra "Agendar nova doação" quando não há agendamento em aberto', async () => {
    vi.mocked(schedulingApi.myAppointments).mockResolvedValue([{ ...appointment, status: 'CANCELED' }])
    renderPage(null)

    expect(await screen.findByRole('link', { name: 'Agendar nova doação' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Em aberto' })).not.toBeInTheDocument()
  })

  it('mostra "Unidade desativada" em vez do id quando a unidade não está mais ativa', async () => {
    renderPage(null)

    expect(await screen.findByText('Unidade desativada')).toBeInTheDocument()
    expect(screen.queryByText('unit-removida')).not.toBeInTheDocument()
  })
})
