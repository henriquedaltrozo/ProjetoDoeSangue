import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { expectedEndFor } from '@/features/eligibility/lib/unfitness-reasons'
import { businessDate } from '@/shared/lib/format'
import { TemporaryUnfitnessForm } from './TemporaryUnfitnessForm'

vi.mock('@/features/eligibility/api/eligibility.api')

function renderForm() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <TemporaryUnfitnessForm donorId="donor-1" onRegistered={() => {}} onCancel={() => {}} />
    </QueryClientProvider>,
  )
}

describe('TemporaryUnfitnessForm', () => {
  it('escolher um motivo da lista preenche a categoria e o fim previsto pelo prazo', async () => {
    renderForm()

    await userEvent.selectOptions(screen.getByLabelText('Motivo'), 'tatuagem')

    expect(screen.getByLabelText('Categoria')).toHaveValue('BEHAVIORAL')
    expect(screen.getByLabelText('Fim previsto (opcional)')).toHaveValue(expectedEndFor(businessDate(), { months: 12 }))
    expect(screen.getByText(/Prazo de referência: 12 meses/)).toBeInTheDocument()
  })

  it('motivo sem prazo fixo deixa o fim previsto em branco', async () => {
    renderForm()

    await userEvent.selectOptions(screen.getByLabelText('Motivo'), 'gravidez')

    expect(screen.getByLabelText('Fim previsto (opcional)')).toHaveValue('')
  })

  it('"Outro" libera o campo para descrever o motivo', async () => {
    renderForm()
    expect(screen.queryByLabelText('Descreva o motivo')).not.toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Motivo'), 'outro')

    expect(screen.getByLabelText('Descreva o motivo')).toBeInTheDocument()
  })
})
