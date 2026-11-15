import { beforeEach, describe, expect, it } from 'vitest'
import type { AuthResponseDto } from '@/shared/types'
import { useAuthStore } from './auth.store'

const authResponse: AuthResponseDto = {
  accessToken: 'access-token-1',
  user: {
    id: 'user-1',
    email: 'donor@example.com',
    name: 'Fulano de Tal',
    role: 'donor',
    donorId: 'donor-1',
    active: true,
    emailVerified: true,
    pendingEmail: null,
  },
}

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.getState().clear()
  })

  it('começa deslogado', () => {
    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(false)
    expect(state.user).toBeNull()
  })

  it('setSession autentica e guarda o usuário e o access token', () => {
    useAuthStore.getState().setSession(authResponse)
    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(true)
    expect(state.accessToken).toBe('access-token-1')
    expect(state.user).toEqual(authResponse.user)
  })

  it('setAccessToken troca só o access token, mantendo o resto da sessão', () => {
    useAuthStore.getState().setSession(authResponse)
    useAuthStore.getState().setAccessToken('access-token-2')
    const state = useAuthStore.getState()
    expect(state.accessToken).toBe('access-token-2')
    expect(state.isAuthenticated).toBe(true)
  })

  it('não persiste tokens no localStorage', () => {
    useAuthStore.getState().setSession(authResponse)
    const stored = localStorage.getItem('doesangue-auth') ?? ''
    expect(stored).not.toContain('access-token-1')
    expect(stored).not.toContain('refresh')
    expect(stored).toContain('donor@example.com')
  })

  it('clear desloga e limpa os tokens', () => {
    useAuthStore.getState().setSession(authResponse)
    useAuthStore.getState().clear()
    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(false)
    expect(state.accessToken).toBeNull()
    expect(state.user).toBeNull()
  })
})
