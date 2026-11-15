import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActivationButton } from './ActivationButton'

afterEach(cleanup)

describe('ActivationButton', () => {
  it('mostra "Desativar" para item ativo e dispara onDeactivate', async () => {
    const onDeactivate = vi.fn()
    render(<ActivationButton active onDeactivate={onDeactivate} onReactivate={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Desativar' }))
    expect(onDeactivate).toHaveBeenCalledTimes(1)
  })

  it('mostra "Reativar" para item desativado e dispara onReactivate', async () => {
    const onReactivate = vi.fn()
    render(<ActivationButton active={false} onDeactivate={vi.fn()} onReactivate={onReactivate} />)
    await userEvent.click(screen.getByRole('button', { name: 'Reativar' }))
    expect(onReactivate).toHaveBeenCalledTimes(1)
  })

  it('bloqueia a desativação quando deactivateDisabled', () => {
    render(<ActivationButton active deactivateDisabled onDeactivate={vi.fn()} onReactivate={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Desativar' })).toBeDisabled()
  })
})
