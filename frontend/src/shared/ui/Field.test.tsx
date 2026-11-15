import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { InputField } from './Field'

describe('InputField', () => {
  it('liga o label ao campo com um id gerado', () => {
    render(<InputField label="Nome completo" />)
    expect(screen.getByLabelText('Nome completo')).toBeInTheDocument()
  })

  it('gera ids diferentes para campos com o mesmo label', () => {
    render(
      <>
        <InputField label="Telefone" />
        <InputField label="Telefone" />
      </>,
    )
    const [first, second] = screen.getAllByLabelText('Telefone')
    expect(first.id).not.toBe(second.id)
  })

  it('marca o campo como inválido e liga a mensagem de erro a ele', () => {
    render(<InputField label="E-mail" error="Informe um e-mail válido." />)
    const input = screen.getByLabelText('E-mail')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Informe um e-mail válido.')
  })

  it('não marca erro quando não há mensagem', () => {
    render(<InputField label="E-mail" />)
    const input = screen.getByLabelText('E-mail')
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(input).not.toHaveAttribute('aria-describedby')
  })
})
