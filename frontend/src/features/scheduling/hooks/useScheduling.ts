import { useMutation, useQuery } from '@tanstack/react-query'
import type { ListAppointmentsFilter } from '@/features/scheduling/api/scheduling.api'
import * as schedulingApi from '@/features/scheduling/api/scheduling.api'
import { QUERY_KEYS } from '@/shared/api/queryKeys'
import { useInvalidatingMutation } from '@/shared/api/useInvalidatingMutation'

export function useUnits() {
  return useQuery({ queryKey: QUERY_KEYS.units, queryFn: schedulingApi.listUnits })
}

export function useAvailability(collectionUnitId: string | undefined, date: string | undefined) {
  return useQuery({
    queryKey: [...QUERY_KEYS.availability, collectionUnitId, date],
    queryFn: () => schedulingApi.checkAvailability(collectionUnitId as string, date as string),
    enabled: Boolean(collectionUnitId && date),
  })
}

export function useMyAppointments() {
  return useQuery({ queryKey: QUERY_KEYS.myAppointments, queryFn: schedulingApi.myAppointments })
}

export function useCreateAppointment() {
  return useInvalidatingMutation(schedulingApi.createAppointment, [QUERY_KEYS.myAppointments, QUERY_KEYS.availability])
}

export function useCancelAppointment() {
  return useInvalidatingMutation(
    ({ id, cancellationReason }: { id: string; cancellationReason?: string }) =>
      schedulingApi.cancelAppointment(id, cancellationReason),
    [QUERY_KEYS.myAppointments, QUERY_KEYS.availability],
  )
}

export function useConfirmAttendance() {
  return useInvalidatingMutation(schedulingApi.confirmAttendance, [
    QUERY_KEYS.myAppointments,
    QUERY_KEYS.adminAppointments,
  ])
}

export function useConfirmAttendanceByToken() {
  return useMutation({ mutationFn: schedulingApi.confirmAttendanceByToken })
}

// --- Operações administrativas ---

const UNITS_KEYS = [QUERY_KEYS.units, QUERY_KEYS.allUnits]

/** Recarrega sozinha a cada minuto: mostra agendamentos novos sem o admin recarregar a página. */
export const ADMIN_APPOINTMENTS_REFRESH_MS = 60_000

export function useAdminAppointments(filter: ListAppointmentsFilter) {
  return useQuery({
    queryKey: [...QUERY_KEYS.adminAppointments, filter],
    queryFn: () => schedulingApi.listAppointments(filter),
    refetchInterval: ADMIN_APPOINTMENTS_REFRESH_MS,
  })
}

/** [admin] Cancela pela equipe (ex.: o check-in foi recusado na reavaliação de elegibilidade). */
export function useStaffCancel() {
  return useInvalidatingMutation(
    (id: string) => schedulingApi.cancelAppointment(id, 'Cancelado pela unidade de coleta.'),
    [QUERY_KEYS.adminAppointments, QUERY_KEYS.availability],
  )
}

export function useCheckin() {
  return useInvalidatingMutation(schedulingApi.checkin, [QUERY_KEYS.adminAppointments])
}

export function useComplete() {
  return useInvalidatingMutation(schedulingApi.complete, [QUERY_KEYS.adminAppointments])
}

export function useNoShow() {
  return useInvalidatingMutation(schedulingApi.markNoShow, [QUERY_KEYS.adminAppointments])
}

export function useAllUnits() {
  return useQuery({ queryKey: QUERY_KEYS.allUnits, queryFn: schedulingApi.listAllUnits })
}

export function useCreateUnit() {
  return useInvalidatingMutation(schedulingApi.createUnit, UNITS_KEYS)
}

/** Desativar a unidade também cancela os agendamentos dela ainda por vir: recarrega as listas. */
export function useDeactivateUnit() {
  return useInvalidatingMutation(schedulingApi.deactivateUnit, [
    ...UNITS_KEYS,
    QUERY_KEYS.adminAppointments,
    QUERY_KEYS.availability,
  ])
}

export function useReactivateUnit() {
  return useInvalidatingMutation(schedulingApi.reactivateUnit, UNITS_KEYS)
}
