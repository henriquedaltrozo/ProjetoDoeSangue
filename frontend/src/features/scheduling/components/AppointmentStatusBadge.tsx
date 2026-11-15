import type { AppointmentStatus } from '@/shared/types'
import { APPOINTMENT_STATUS_LABEL } from '@/shared/types'
import { Badge, type BadgeTone } from '@/shared/ui/Badge'

const STATUS_TONE: Record<AppointmentStatus, BadgeTone> = {
  SCHEDULED: 'neutral',
  ELIGIBILITY_CONFIRMED: 'success',
  ELIGIBILITY_DENIED: 'danger',
  CONFIRMED: 'success',
  CHECKIN_PERFORMED: 'info',
  COMPLETED: 'done',
  CANCELED: 'muted',
  NO_SHOW: 'warning',
}

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} className={status === 'CANCELED' ? 'line-through' : ''}>
      {APPOINTMENT_STATUS_LABEL[status]}
    </Badge>
  )
}
