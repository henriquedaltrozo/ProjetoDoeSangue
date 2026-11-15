import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { me } from '@/features/auth'
import type { RegisterUnfitnessPayload, UpdateProfilePayload } from '@/features/eligibility/api/eligibility.api'
import * as eligibilityApi from '@/features/eligibility/api/eligibility.api'
import { myAppointments } from '@/features/scheduling'
import { QUERY_KEYS } from '@/shared/api/queryKeys'
import { useInvalidatingMutation } from '@/shared/api/useInvalidatingMutation'
import type { DonorResponseDto } from '@/shared/types'

/** Perfil do próprio doador logado. */
export function useMyProfile() {
  return useQuery({ queryKey: QUERY_KEYS.myProfile, queryFn: eligibilityApi.myProfile })
}

/** Atualiza os dados do perfil do doador e recarrega o perfil. */
export function useUpdateProfile(donorId: string | null | undefined) {
  return useInvalidatingMutation(
    (values: UpdateProfilePayload) => eligibilityApi.updateDonor(donorId as string, values),
    // Os dados mudaram: a situação para doar também pode ter mudado.
    [QUERY_KEYS.myProfile, QUERY_KEYS.eligibilityCheck],
  )
}

/**
 * "Posso doar hoje?": a situação do doador agora. A consulta não é gravada no backend, então pode
 * ser feita ao abrir a tela (início e perfil) e refeita quando os dados mudam.
 */
export function useEligibilityCheck(donorId: string | null | undefined) {
  return useQuery({
    queryKey: [...QUERY_KEYS.eligibilityCheck, donorId],
    queryFn: () => eligibilityApi.assessNow(donorId as string),
    enabled: Boolean(donorId),
  })
}

/**
 * [LGPD] Portabilidade: reúne o que os três serviços guardam sobre o doador (auth, eligibility,
 * scheduling) num único objeto. Não há provedor de e-mail neste projeto, então o "envio" dos dados
 * é o download direto no navegador (feito pela tela com o resultado).
 */
export function useExportMyData(donorId: string | null | undefined) {
  return useMutation({
    mutationFn: async () => {
      const [myAccount, donorData, appointments] = await Promise.all([
        me(),
        eligibilityApi.exportData(donorId as string),
        myAppointments(),
      ])
      return { exportedAt: new Date().toISOString(), myAccount, ...donorData, appointments }
    },
  })
}

// --- [admin] ---

/** Termo mínimo da busca de doadores: sem ele, a tela não lista ninguém (cada doador listado é auditado). */
export const MIN_DONOR_SEARCH_LENGTH = 2

export function useDonors(search: string, page: number) {
  return useQuery({
    queryKey: [...QUERY_KEYS.donors, search, page],
    queryFn: () => eligibilityApi.searchDonors(search, page),
    enabled: search.length >= MIN_DONOR_SEARCH_LENGTH,
    // Mantém a lista anterior na tela enquanto a nova busca carrega (sem "piscar" a cada termo).
    placeholderData: keepPreviousData,
  })
}

/**
 * [admin] Nome de cada doador da lista (ex.: agendamentos), numa única busca pelos ids. Devolve um
 * mapa id -> nome; enquanto carrega (ou se falhar), o mapa fica vazio e a tela mostra só o link.
 */
export function useDonorNames(donorIds: string[]): Map<string, string> {
  const ids = [...new Set(donorIds)].sort()
  const donors = useQuery({
    queryKey: [...QUERY_KEYS.donors, 'by-ids', ids],
    queryFn: () => eligibilityApi.listDonorsByIds(ids),
    enabled: ids.length > 0,
    placeholderData: keepPreviousData,
  })
  return new Map((donors.data ?? []).map((d) => [d.id, d.completeName]))
}

export function useDonor(donorId: string) {
  return useQuery({
    queryKey: [...QUERY_KEYS.donor, donorId],
    queryFn: () => eligibilityApi.findDonor(donorId),
    enabled: Boolean(donorId),
  })
}

export function useDonorUnfitness(donorId: string) {
  return useQuery({
    queryKey: [...QUERY_KEYS.unfitness, donorId],
    queryFn: () => eligibilityApi.listUnfitness(donorId),
    enabled: Boolean(donorId),
  })
}

/** [admin] Log de auditoria do doador; só é buscado quando `enabled` (o admin abriu o log). */
export function useDonorAudit(donorId: string, enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEYS.audit, donorId],
    queryFn: () => eligibilityApi.listAudit(donorId),
    enabled: Boolean(donorId) && enabled,
  })
}

export function useRegisterUnfitness(donorId: string) {
  return useInvalidatingMutation(
    (values: RegisterUnfitnessPayload) => eligibilityApi.registerUnfitness(donorId, values),
    [
      [...QUERY_KEYS.unfitness, donorId],
      [...QUERY_KEYS.audit, donorId],
      // A situação para doar (no topo do detalhe) muda com a inaptidão.
      [...QUERY_KEYS.eligibilityCheck, donorId],
    ],
  )
}

export function useDeleteUnfitness(donorId: string) {
  return useInvalidatingMutation(
    (unfitnessId: string) => eligibilityApi.deleteUnfitness(donorId, unfitnessId),
    [
      [...QUERY_KEYS.unfitness, donorId],
      [...QUERY_KEYS.audit, donorId],
      [...QUERY_KEYS.eligibilityCheck, donorId],
    ],
  )
}

export function useEndUnfitness(donorId: string) {
  return useInvalidatingMutation(
    (unfitnessId: string) => eligibilityApi.endUnfitness(donorId, unfitnessId),
    [
      [...QUERY_KEYS.unfitness, donorId],
      [...QUERY_KEYS.audit, donorId],
      // A situação para doar (no topo do detalhe) muda com a inaptidão.
      [...QUERY_KEYS.eligibilityCheck, donorId],
    ],
  )
}

/** [admin] Registra ou desfaz a inaptidão permanente e recarrega o doador. */
export function usePermanentUnfitness(donorId: string) {
  const invalidate = [
    [...QUERY_KEYS.donor, donorId],
    [...QUERY_KEYS.audit, donorId],
    [...QUERY_KEYS.eligibilityCheck, donorId],
  ]
  return {
    register: useInvalidatingMutation<DonorResponseDto, string>(
      (reason) => eligibilityApi.registerPermanentUnfitness(donorId, reason),
      invalidate,
    ),
    revoke: useInvalidatingMutation<DonorResponseDto, void>(
      () => eligibilityApi.revokePermanentUnfitness(donorId),
      invalidate,
    ),
  }
}

/** [admin] Registra ou desfaz a avaliação médica (70 anos ou mais) e recarrega o doador. */
export function useMedicalClearance(donorId: string) {
  const invalidate = [
    [...QUERY_KEYS.donor, donorId],
    [...QUERY_KEYS.audit, donorId],
    [...QUERY_KEYS.eligibilityCheck, donorId],
  ]
  return {
    register: useInvalidatingMutation<DonorResponseDto, void>(
      () => eligibilityApi.registerMedicalClearance(donorId),
      invalidate,
    ),
    revoke: useInvalidatingMutation<DonorResponseDto, void>(
      () => eligibilityApi.revokeMedicalClearance(donorId),
      invalidate,
    ),
  }
}
