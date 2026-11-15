import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import * as authApi from '@/features/auth/api/auth.api'
import { renewSession } from '@/shared/api/http'
import { QUERY_KEYS } from '@/shared/api/queryKeys'
import { useInvalidatingMutation } from '@/shared/api/useInvalidatingMutation'
import { useAuthStore } from '@/shared/session/auth.store'
import { homePathFor } from '@/shared/session/homePath'

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession)
  const navigate = useNavigate()

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (auth) => {
      setSession(auth)
      navigate(homePathFor(auth.user.role), { replace: true })
    },
  })
}

export function useRegisterDonor() {
  const setSession = useAuthStore((s) => s.setSession)
  const navigate = useNavigate()

  return useMutation({
    mutationFn: authApi.registerDonor,
    onSuccess: (auth) => {
      setSession(auth)
      navigate('/appointments', { replace: true })
    },
  })
}

/**
 * Invalida a lista de admins ao cadastrar. No bootstrap (sem sessão) a lista não está
 * carregada e a invalidação não dispara nada, então não sai nenhuma chamada sem token.
 */
export function useRegisterAdmin() {
  return useInvalidatingMutation(authApi.registerAdmin, [QUERY_KEYS.admins])
}

export function useForgotPassword() {
  return useMutation({ mutationFn: authApi.forgotPassword })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ token, newPassword }: { token: string; newPassword: string }) =>
      authApi.resetPassword(token, newPassword),
  })
}

/**
 * Troca nome/e-mail da conta: atualiza o usuário da sessão e recarrega o perfil de doador, que
 * guarda os mesmos dados.
 */
export function useUpdateMe() {
  const setUser = useAuthStore((s) => s.setUser)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: authApi.updateMe,
    onSuccess: (user) => {
      setUser(user)
      return queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myProfile })
    },
  })
}

/**
 * [LGPD] Exclusão (anonimização) da própria conta. A conta fica inativa no
 * mesmo instante, então limpamos a sessão local e mandamos para o login
 * assim que o backend confirma - não faz sentido deixar a pessoa "logada"
 * numa conta que ela acabou de pedir para anonimizar.
 */
export function useDeleteMyAccount() {
  const clear = useAuthStore((s) => s.clear)
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (currentPassword: string) => authApi.deleteMyData(currentPassword),
    onSuccess: () => {
      clear()
      navigate('/login', { replace: true })
    },
  })
}

/** [admin] Lista os usuários admin (tela /admin/admins, só para admins logados). */
export function useAdmins() {
  return useQuery({ queryKey: QUERY_KEYS.admins, queryFn: authApi.listAdmins })
}

export function useDeactivateAdmin() {
  return useInvalidatingMutation(authApi.deactivateAdmin, [QUERY_KEYS.admins])
}

export function useReactivateAdmin() {
  return useInvalidatingMutation(authApi.reactivateAdmin, [QUERY_KEYS.admins])
}

export function useLogout() {
  const clear = useAuthStore((s) => s.clear)
  const navigate = useNavigate()

  return () => {
    // Importante: só limpamos a sessão (clear()) DEPOIS que a chamada a
    // /auth/logout sai - o interceptor de request lê o accessToken do
    // store de forma assíncrona (microtask), então limpar o store antes
    // faria a requisição sair sem Authorization e voltar 401 à toa (o
    // refresh token nem seria revogado no servidor).
    const finalize = () => {
      clear()
      navigate('/login', { replace: true })
    }
    authApi.logout().finally(finalize)
  }
}

/**
 * Confirma o e-mail pelo link. Se este navegador tem sessão, renova-a em seguida: o token novo já
 * diz que o e-mail foi confirmado (e, numa troca, traz o e-mail novo).
 */
export function useVerifyEmail() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (token: string) => authApi.verifyEmail(token),
    onSuccess: async () => {
      if (!useAuthStore.getState().isAuthenticated) return
      try {
        await renewSession()
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myProfile })
      } catch {
        // Sessão vencida: a confirmação valeu do mesmo jeito; o próximo login já vem atualizado.
      }
    },
  })
}

export function useResendVerification() {
  return useMutation({ mutationFn: () => authApi.resendVerification() })
}
