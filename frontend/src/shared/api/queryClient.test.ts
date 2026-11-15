import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '@/shared/session/auth.store'
import type { UserResponseDto } from '@/shared/types'
import { clearCacheOnUserChange, createQueryClient } from './queryClient'

const donorA: UserResponseDto = {
  id: 'user-a',
  email: 'a@example.com',
  name: 'Doador A',
  role: 'donor',
  donorId: 'donor-a',
  active: true,
  emailVerified: true,
  pendingEmail: null,
}
const donorB: UserResponseDto = { ...donorA, id: 'user-b', email: 'b@example.com', donorId: 'donor-b' }

describe('clearCacheOnUserChange', () => {
  const queryClient = createQueryClient()
  let unsubscribe: () => void

  beforeEach(() => {
    useAuthStore.getState().clear()
    unsubscribe = clearCacheOnUserChange(queryClient)
    useAuthStore.getState().setSession({ accessToken: 'token-1', user: donorA })
    queryClient.setQueryData(['my-profile'], { completeName: 'Doador A' })
  })

  afterEach(() => {
    unsubscribe()
    queryClient.clear()
  })

  it('apaga o cache no logout (ou sessão expirada / conta excluída)', () => {
    useAuthStore.getState().clear()
    expect(queryClient.getQueryData(['my-profile'])).toBeUndefined()
  })

  it('apaga o cache quando outra pessoa entra', () => {
    useAuthStore.getState().setSession({ accessToken: 'token-2', user: donorB })
    expect(queryClient.getQueryData(['my-profile'])).toBeUndefined()
  })

  it('mantém o cache quando só o token é renovado', () => {
    useAuthStore.getState().setSession({ accessToken: 'token-renovado', user: donorA })
    useAuthStore.getState().setAccessToken('outro-token')
    expect(queryClient.getQueryData(['my-profile'])).toEqual({ completeName: 'Doador A' })
  })
})
