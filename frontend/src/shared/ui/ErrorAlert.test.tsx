import { cleanup, render, screen } from '@testing-library/react'
import { AxiosError } from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import { ErrorAlert } from './ErrorAlert'

afterEach(cleanup)

describe('ErrorAlert', () => {
  it('não renderiza nada quando não há erro', () => {
    const { container } = render(<ErrorAlert error={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('exibe a mensagem devolvida pela API', () => {
    const error = new AxiosError('failed')
    error.response = { data: { message: 'CPF já cadastrado.' } } as AxiosError['response']
    render(<ErrorAlert error={error} />)
    expect(screen.getByRole('alert')).toHaveTextContent('CPF já cadastrado.')
  })

  it('usa o texto padrão quando o erro não vem da API', () => {
    render(<ErrorAlert error={new Error('x')} fallback="Não foi possível salvar." />)
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível salvar.')
  })
})
