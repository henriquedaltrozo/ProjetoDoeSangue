import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as eligibilityApi from '@/features/eligibility/api/eligibility.api'
import type { DonorResponseDto } from '@/shared/types'
import { AdminDonorDetailPage } from './AdminDonorDetailPage'

vi.mock('@/features/eligibility/api/eligibility.api')

const donor = {
  id: 'donor-1',
  completeName: 'Maria Doadora',
  cpf: '12345678909',
  birthDate: '1995-04-12',
  sex: 'F',
  phone: '11999998888',
  email: 'maria@example.com',
  weightKg: 65,
  healthDataConsentAt: '2026-01-01T12:00:00.000Z',
  bloodType: 'O-',
  lastDonationAt: null,
  permanentUnfit: false,
  permanentUnfitnessReason: null,
} as DonorResponseDto

function renderPage(entries: string[]) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
        <Routes>
          <Route path="/admin" element={<div>Tela de agendamentos</div>} />
          <Route path="/admin/donors" element={<div>Lista de doadores</div>} />
          <Route path="/admin/donors/:id" element={<AdminDonorDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AdminDonorDetailPage - botão Voltar', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(eligibilityApi.findDonor).mockResolvedValue(donor)
    vi.mocked(eligibilityApi.listUnfitness).mockResolvedValue([])
    vi.mocked(eligibilityApi.listAudit).mockResolvedValue([])
  })

  it('volta para a tela de onde o admin veio (ex.: agendamentos)', async () => {
    renderPage(['/admin', '/admin/donors/donor-1'])

    await userEvent.click(await screen.findByRole('button', { name: '← Voltar' }))

    expect(screen.getByText('Tela de agendamentos')).toBeInTheDocument()
  })

  it('vai para a lista de doadores quando a página foi aberta direto pelo endereço', async () => {
    renderPage(['/admin/donors/donor-1'])

    await userEvent.click(await screen.findByRole('button', { name: '← Voltar' }))

    expect(screen.getByText('Lista de doadores')).toBeInTheDocument()
  })
})
