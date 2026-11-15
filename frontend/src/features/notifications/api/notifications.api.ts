import { http } from '@/shared/api/http'

export type NotificationStatus = 'SENT' | 'FAILURE' | 'SUPPRESSED'

/** Um envio do registro (destinatário e erro já vêm mascarados do backend). */
export interface SentNotificationDto {
  id: string
  type: string
  recipient: string
  subject: string
  status: NotificationStatus
  error: string | null
  jobId: string | null
  sentAt: string | null
}

export interface SentNotificationsPageDto {
  items: SentNotificationDto[]
  total: number
  page: number
  pageSize: number
}

/** E-mail que esgotou as tentativas (fica 7 dias na fila). */
export interface FailedJobDto {
  id: string
  type: string
  failedReason: string
  attemptsMade: number
  failedAt: string | null
}

/** Endereço bloqueado: devolveu e-mail ou marcou como spam. */
export interface SuppressedRecipientDto {
  email: string
  reason: string
  createdAt: string
}

export async function listSent(page: number, status?: NotificationStatus): Promise<SentNotificationsPageDto> {
  const { data } = await http.get<SentNotificationsPageDto>('/notifications/sent', {
    params: { page, ...(status && { status }) },
  })
  return data
}

export async function listFailedJobs(): Promise<FailedJobDto[]> {
  const { data } = await http.get<FailedJobDto[]>('/notifications/failed-jobs')
  return data
}

export async function retryFailedJob(id: string): Promise<void> {
  await http.post(`/notifications/failed-jobs/${encodeURIComponent(id)}/retry`)
}

export async function listSuppressed(): Promise<SuppressedRecipientDto[]> {
  const { data } = await http.get<SuppressedRecipientDto[]>('/notifications/suppressed')
  return data
}

export async function unblockRecipient(email: string): Promise<void> {
  await http.delete(`/notifications/suppressed/${encodeURIComponent(email)}`)
}
