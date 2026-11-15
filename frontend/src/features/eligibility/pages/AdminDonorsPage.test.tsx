import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as eligibilityApi from '@/features/eligibility/api/eligibility.api'
import type { DonorResponseDto, DonorSearchResponseDto } from '@/shared/types'
import { AdminDonorsPage } from './AdminDonorsPage'

vi.mock('@/features/eligibility/api/eligibility.api')

const PAGE_SIZE = 20

function donor(n: number): DonorResponseDto {
  const id = String(n).padStart(2, '0')
  return { id: `d-${id}`, completeName: `Maria ${id}`, cpf: `333333333${id}`, bloodType: null } as DonorResponseDto
}

/** 25 "Maria": 20 na página 1, 5 na página 2. */
function pageOf(page: number): DonorSearchResponseDto {
  const all = Array.from({ length: 25 }, (_, i) => donor(i + 1))
  return { items: all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total: all.length, page, pageSize: PAGE_SIZE }
}

/** Mostra o endereço atual, para conferir que a busca e a página ficam nele. */
function CurrentUrl() {
  const location = useLocation()
  return <output data-testid="url">{location.search}</output>
}

function renderPage(entry: string) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route
            path="/admin/donors"
            element={
              <>
                <AdminDonorsPage />
                <CurrentUrl />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AdminDonorsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(eligibilityApi.searchDonors).mockImplementation(async (_search, page) => pageOf(page))
  })

  it('retoma a busca e a página que estão no endereço (ex.: ao voltar do detalhe do doador)', async () => {
    renderPage('/admin/donors?q=maria&page=2')

    expect(await screen.findByText('25 doadores encontrados - página 2 de 2')).toBeInTheDocument()
    expect(screen.getByLabelText('Buscar por nome ou CPF')).toHaveValue('maria')
    expect(eligibilityApi.searchDonors).toHaveBeenCalledWith('maria', 2)
    expect(screen.getByText('Maria 21')).toBeInTheDocument()
    expect(screen.queryByText('Maria 01')).not.toBeInTheDocument()
  })

  it('troca de página pelos botões e guarda a página no endereço', async () => {
    renderPage('/admin/donors?q=maria')

    expect(await screen.findByText('Maria 01')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '← Anterior' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Próxima →' }))

    expect(await screen.findByText('Maria 21')).toBeInTheDocument()
    expect(screen.getByTestId('url')).toHaveTextContent('?q=maria&page=2')
    expect(screen.getByRole('button', { name: 'Próxima →' })).toBeDisabled()
  })

  it('uma busca nova vai para o endereço e volta para a página 1', async () => {
    renderPage('/admin/donors?q=maria&page=2')
    await screen.findByText('Maria 21')

    const input = screen.getByLabelText('Buscar por nome ou CPF')
    await userEvent.clear(input)
    await userEvent.type(input, 'joao')

    await vi.waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('?q=joao'))
    expect(screen.getByTestId('url')).not.toHaveTextContent('page')
    expect(eligibilityApi.searchDonors).toHaveBeenLastCalledWith('joao', 1)
  })

  it('não busca com menos de 2 caracteres', () => {
    renderPage('/admin/donors?q=m')

    expect(screen.getByText(/Digite ao menos 2 caracteres/)).toBeInTheDocument()
    expect(eligibilityApi.searchDonors).not.toHaveBeenCalled()
  })
})
