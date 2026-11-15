import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('dispara onClick quando clicado', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Confirmar</Button>)

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('fica desabilitado enquanto loading', () => {
    render(<Button loading>Salvando</Button>)
    expect(screen.getByRole('button', { name: 'Salvando' })).toBeDisabled()
  })

  it('respeita a prop disabled mesmo sem loading', () => {
    render(<Button disabled>Indisponível</Button>)
    expect(screen.getByRole('button', { name: 'Indisponível' })).toBeDisabled()
  })
})
