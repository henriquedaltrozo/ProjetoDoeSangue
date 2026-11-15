import { type QueryKey, useMutation, useQueryClient } from '@tanstack/react-query'

/**
 * `useMutation` que, ao dar certo, invalida as queries indicadas - evita
 * repetir `useQueryClient` + `onSuccess` + `invalidateQueries` em cada hook.
 */
export function useInvalidatingMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  queryKeys: QueryKey[],
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => Promise.all(queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  })
}
