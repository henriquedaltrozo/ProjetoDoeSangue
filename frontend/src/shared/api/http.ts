import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/shared/session/auth.store'
import type { AuthResponseDto } from '@/shared/types'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

// withCredentials: o refresh token vive num cookie httpOnly, que o navegador só envia
// (e aceita) em requisições "com credenciais" para o gateway.
export const http = axios.create({ baseURL: API_URL, withCredentials: true })

http.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState()
  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`)
  }
  return config
})

const PUBLIC_ENDPOINTS = [
  '/auth/login',
  '/auth/refresh',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
  '/appointments/confirm-attendance',
]

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

// Evita disparar várias renovações de token em paralelo quando várias
// requisições batem em 401 ao mesmo tempo: todas aguardam a mesma promise.
let refreshPromise: Promise<string> | null = null

async function renewAccessToken(): Promise<string> {
  // O refresh token não é acessível ao JavaScript: o navegador o envia sozinho, via cookie.
  const { data } = await axios.post<AuthResponseDto>(`${API_URL}/auth/refresh`, undefined, {
    withCredentials: true,
  })
  useAuthStore.getState().setSession(data)
  return data.accessToken
}

/**
 * Renova a sessão agora (pelo cookie), para o token e o usuário refletirem uma mudança da conta
 * feita fora desta aba - por exemplo, o e-mail confirmado pelo link.
 */
export function renewSession(): Promise<string> {
  refreshPromise ??= renewAccessToken().finally(() => {
    refreshPromise = null
  })
  return refreshPromise
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined
    // Rotas em que o 401 não é sessão vencida, e sim a resposta da própria tela (senha errada,
    // token de redefinição ou de confirmação inválido): o erro vai direto para a tela.
    const isPublicEndpoint = PUBLIC_ENDPOINTS.some((path) => config?.url?.startsWith(path))
    // Sem sessão não há o que renovar: tentar só trocaria a mensagem por "Sessão ausente ou expirada".
    const hasSession = useAuthStore.getState().isAuthenticated

    if (error.response?.status !== 401 || !config || config._retry || isPublicEndpoint || !hasSession) {
      throw error
    }

    config._retry = true
    try {
      const newToken = await renewSession()
      config.headers.set('Authorization', `Bearer ${newToken}`)
      return http(config)
    } catch (refreshError) {
      useAuthStore.getState().clear()
      throw refreshError
    }
  },
)

/**
 * Mensagens padrão do framework (em inglês), que não devem chegar ao usuário: as do sistema são em
 * português e vêm das regras de negócio.
 */
const FRAMEWORK_MESSAGES = [
  /^Unauthorized$/i,
  /^Forbidden( resource)?$/i,
  /^Not Found$/i,
  /^Bad Request$/i,
  /^Internal server error$/i,
  /Too Many Requests/i,
  /^Cannot (GET|POST|PUT|PATCH|DELETE) /,
  /should not exist$/,
]

const isFrameworkMessage = (message: string) => FRAMEWORK_MESSAGES.some((pattern) => pattern.test(message))

/**
 * Extrai uma mensagem de erro legível, sempre em português, de uma resposta de erro da API: a
 * mensagem das regras de negócio quando existe; para falhas de conexão, excesso de tentativas, erro
 * interno ou mensagens padrão do framework, um texto próprio ou o `fallback` da tela.
 */
export function extractErrorMessage(err: unknown, fallback = 'Algo deu errado. Tente novamente.'): string {
  if (!axios.isAxiosError(err)) {
    return fallback
  }
  if (!err.response) {
    return 'Não foi possível conectar ao servidor. Verifique sua conexão e tente de novo.'
  }
  const status = err.response.status
  if (status === 429) {
    return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.'
  }
  // Erro interno: o texto do servidor não ajuda o usuário (e não deve vazar detalhes).
  if (status >= 500) {
    return fallback
  }
  const raw = err.response.data?.message
  const messages = (Array.isArray(raw) ? raw : [raw]).filter(
    (m): m is string => typeof m === 'string' && m.length > 0 && !isFrameworkMessage(m),
  )
  if (messages.length > 0) {
    return messages.join(' ')
  }
  if (status === 401) return 'Sua sessão expirou. Entre de novo.'
  if (status === 403) return 'Você não tem permissão para fazer isso.'
  return fallback
}
