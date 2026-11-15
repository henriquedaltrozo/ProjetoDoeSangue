import { formatDate } from '@/shared/lib/format'
import {
  type AppointmentCreatedDto,
  ASSESSMENT_NOTICE_LABEL,
  ELIGIBILITY_RESULT_LABEL,
  INELIGIBILITY_REASON_LABEL,
} from '@/shared/types'
import { Alert } from '@/shared/ui/Alert'

/** Resultado da avaliação de elegibilidade feita ao criar o agendamento. */
export function ScheduleResultAlert({
  appointment,
  onClose,
}: {
  appointment: AppointmentCreatedDto
  onClose?: () => void
}) {
  const assessment = appointment.eligibilityAssessment
  const eligible = appointment.status === 'ELIGIBILITY_CONFIRMED'

  return (
    <Alert
      variant={eligible ? 'success' : 'warning'}
      title={eligible ? 'Agendamento criado' : 'Agendamento recusado: você não pode doar nesta data'}
      onClose={onClose}
    >
      <p>
        Resultado da avaliação de elegibilidade:{' '}
        <strong>{assessment ? ELIGIBILITY_RESULT_LABEL[assessment.result] : '-'}</strong>.
      </p>
      {assessment && assessment.reasons.length > 0 && (
        <ul className="list-inside list-disc">
          {assessment.reasons.map((reason) => (
            <li key={reason}>{INELIGIBILITY_REASON_LABEL[reason]}</li>
          ))}
        </ul>
      )}
      {assessment && assessment.notices.length > 0 && (
        <ul className="list-inside list-disc font-medium">
          {assessment.notices.map((notice) => (
            <li key={notice}>{ASSESSMENT_NOTICE_LABEL[notice]}</li>
          ))}
        </ul>
      )}
      {assessment?.nextEligibilityDate && (
        <p>Você poderá doar novamente a partir de {formatDate(assessment.nextEligibilityDate)}.</p>
      )}
    </Alert>
  )
}
