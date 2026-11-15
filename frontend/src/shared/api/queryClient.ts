import { QueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/shared/session/auth.store'

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  })
}

/**
 * [LGPD] Apaga o cache de dados sempre que o usuário da sessão muda: logout, exclusão da conta,
 * sessão expirada (refresh recusado) ou login de outra pessoa. Sem isso, quem entra em seguida na
 * mesma aba veria por um instante os dados do usuário anterior (perfil, agendamentos...).
 * A renovação do token mantém o mesmo usuário, então não apaga nada.
 * Devolve a função que cancela a ligação (usada nos testes).
 */
export function clearCacheOnUserChange(queryClient: QueryClient): () => void {
  return useAuthStore.subscribe((state, previous) => {
    if (state.user?.id !== previous.user?.id) {
      queryClient.clear()
    }
  })
}

/** Instância única usada pela aplicação. */
export const queryClient = createQueryClient()
clearCacheOnUserChange(queryClient)
