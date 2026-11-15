import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '@/shared/session/auth.store'
import type { UserResponseDto } from '@/shared/types'
import { ProtectedRoute } from './ProtectedRoute'

const donor: UserResponseDto = {
  id: 'user-1',
  email: 'donor@example.com',
  name: 'Fulano',
  role: 'donor',
  donorId: 'donor-1',
  active: true,
  emailVerified: true,
  pendingEmail: null,
}

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

function renderWithRoute(allow?: ('donor' | 'admin')[]) {
  return render(
    <MemoryRouter initialEntries={['/protected-route']}>
      <Routes>
        <Route path="/login" element={<div>Tela de login</div>} />
        <Route path="/appointments" element={<div>Meus agendamentos</div>} />
        <Route path="/admin" element={<div>Painel admin</div>} />
        <Route element={<ProtectedRoute allow={allow} />}>
          <Route path="/protected-route" element={<div>Conteúdo protegido</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuthStore.getState().clear()
  })

  it('redireciona para /login quando não autenticado', () => {
    renderWithRoute()
    expect(screen.getByText('Tela de login')).toBeInTheDocument()
  })

  it('renderiza o conteúdo quando autenticado e sem restrição de papel', () => {
    useAuthStore.setState({ isAuthenticated: true, user: donor })
    renderWithRoute()
    expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument()
  })

  it('renderiza o conteúdo quando o papel do usuário está na lista `allow`', () => {
    useAuthStore.setState({ isAuthenticated: true, user: donor })
    renderWithRoute(['donor'])
    expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument()
  })

  it('redireciona um doador para /appointments quando a rota exige admin', () => {
    useAuthStore.setState({ isAuthenticated: true, user: donor })
    renderWithRoute(['admin'])
    expect(screen.getByText('Meus agendamentos')).toBeInTheDocument()
  })

  it('redireciona um admin para /admin quando a rota exige donor', () => {
    useAuthStore.setState({ isAuthenticated: true, user: admin })
    renderWithRoute(['donor'])
    expect(screen.getByText('Painel admin')).toBeInTheDocument()
  })
})
