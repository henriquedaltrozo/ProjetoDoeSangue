import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AuthPageLayout } from './AuthPageLayout'

afterEach(cleanup)

describe('AuthPageLayout', () => {
  it('exibe título, subtítulo e conteúdo', () => {
    render(
      <AuthPageLayout title="Entrar" subtitle="Acesse sua conta.">
        <p>formulário</p>
      </AuthPageLayout>,
    )
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.getByText('Acesse sua conta.')).toBeInTheDocument()
    expect(screen.getByText('formulário')).toBeInTheDocument()
  })

  it('omite o subtítulo quando não informado', () => {
    render(
      <AuthPageLayout title="Confirmar presença">
        <p>conteúdo</p>
      </AuthPageLayout>,
    )
    expect(screen.queryByText('Acesse sua conta.')).not.toBeInTheDocument()
  })
})
