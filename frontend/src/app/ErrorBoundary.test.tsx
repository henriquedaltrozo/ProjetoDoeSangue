import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

function Boom(): never {
  throw new Error('falhou')
}

describe('ErrorBoundary', () => {
  afterEach(() => vi.restoreAllMocks())

  it('renderiza os filhos quando não há erro', () => {
    render(
      <ErrorBoundary>
        <p>conteúdo</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('conteúdo')).toBeInTheDocument()
  })

  it('mostra o aviso quando um filho quebra na renderização', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Algo deu errado')
    expect(screen.getByRole('button', { name: 'Recarregar' })).toBeInTheDocument()
  })
})
