import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthResponseDto, UserResponseDto } from '@/shared/types'

interface AuthState {
  accessToken: string | null
  user: UserResponseDto | null
  isAuthenticated: boolean
  setSession: (auth: AuthResponseDto) => void
  setAccessToken: (accessToken: string) => void
  /** Atualiza o perfil básico (ex.: o usuário trocou nome ou e-mail), mantendo a sessão. */
  setUser: (user: UserResponseDto) => void
  clear: () => void
}

/**
 * Sessão do usuário logado (doador ou admin). Em localStorage ficam só o perfil básico e a
 * flag de sessão: nenhum token. O access token (curto) vive só em memória e o refresh token
 * está num cookie httpOnly - ao recarregar a página, o primeiro 401 dispara a renovação
 * silenciosa pelo cookie (ver http.ts).
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      isAuthenticated: false,
      setSession: (auth) =>
        set({
          accessToken: auth.accessToken,
          user: auth.user,
          isAuthenticated: true,
        }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setUser: (user) => set({ user }),
      clear: () => set({ accessToken: null, user: null, isAuthenticated: false }),
    }),
    {
      name: 'doesangue-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    },
  ),
)
