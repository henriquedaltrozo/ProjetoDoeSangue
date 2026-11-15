import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { NotificationStatus } from '@/features/notifications/api/notifications.api'
import * as api from '@/features/notifications/api/notifications.api'
import { useInvalidatingMutation } from '@/shared/api/useInvalidatingMutation'

const KEYS = {
  sent: ['notifications', 'sent'],
  failedJobs: ['notifications', 'failed-jobs'],
  suppressed: ['notifications', 'suppressed'],
} as const

export function useSentNotifications(page: number, status?: NotificationStatus) {
  return useQuery({
    queryKey: [...KEYS.sent, page, status ?? 'all'],
    queryFn: () => api.listSent(page, status),
    placeholderData: keepPreviousData,
  })
}

export function useFailedJobs() {
  return useQuery({ queryKey: KEYS.failedJobs, queryFn: api.listFailedJobs })
}

export function useRetryFailedJob() {
  return useInvalidatingMutation((id: string) => api.retryFailedJob(id), [KEYS.failedJobs, KEYS.sent])
}

export function useSuppressed() {
  return useQuery({ queryKey: KEYS.suppressed, queryFn: api.listSuppressed })
}

export function useUnblockRecipient() {
  return useInvalidatingMutation((email: string) => api.unblockRecipient(email), [KEYS.suppressed])
}
