import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '@/shared/session/auth.store'
import type { UserResponseDto } from '@/shared/types'
import { PublicOnlyRoute } from './PublicOnlyRoute'

const admin: UserResponseDto = {
  id: 'user-2',
  email: 'admin@example.com',
  name: 'Admin',
  role: 'admin',
  donorId: null,
  active: true,
  emailVerified: true,
  pendingEmail: null,
}

function renderRegistration() {
  return render(
    <MemoryRouter initialEntries={['/registration']}>
      <Routes>
        <Route path="/admin" element={<div>Painel admin</div>} />
        <Route element={<PublicOnlyRoute />}>
          <Route path="/registration" element={<div>Cadastro de doador</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('PublicOnlyRoute', () => {
  beforeEach(() => {
    useAuthStore.getState().clear()
  })

  it('sem sessão, mostra a tela pública', () => {
    renderRegistration()
    expect(screen.getByText('Cadastro de doador')).toBeInTheDocument()
  })

  it('com sessão, manda para a tela inicial do papel', () => {
    useAuthStore.getState().setSession({ accessToken: 'token', user: admin })
    renderRegistration()
    expect(screen.getByText('Painel admin')).toBeInTheDocument()
  })
})
