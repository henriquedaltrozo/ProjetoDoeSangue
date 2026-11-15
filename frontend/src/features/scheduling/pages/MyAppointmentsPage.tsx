import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CampaignsForYou } from '@/features/campaigns'
import { useMyProfile } from '@/features/eligibility'
import { AppointmentStatusBadge } from '@/features/scheduling/components/AppointmentStatusBadge'
import { ScheduleResultAlert } from '@/features/scheduling/components/ScheduleResultAlert'
import {
  useCancelAppointment,
  useConfirmAttendance,
  useMyAppointments,
  useUnits,
} from '@/features/scheduling/hooks/useScheduling'
import { canConfirmAttendance, isOpenForDonor } from '@/features/scheduling/lib/attendance'
import { unitLabel } from '@/features/scheduling/lib/units'
import type { ScheduleResultState } from '@/features/scheduling/pages/SchedulePage'
import { formatDateTime } from '@/shared/lib/format'
import { useNow } from '@/shared/lib/useNow'
import { usePageTitle } from '@/shared/lib/usePageTitle'
import { type AppointmentDto, ASSESSMENT_NOTICE_LABEL } from '@/shared/types'
import { Button } from '@/shared/ui/Button'
import { ButtonLink } from '@/shared/ui/ButtonLink'
import { Card } from '@/shared/ui/Card'
import { ConfirmBox } from '@/shared/ui/ConfirmBox'
import { ErrorAlert } from '@/shared/ui/ErrorAlert'
import { TextareaField } from '@/shared/ui/Field'
import { PageTitle } from '@/shared/ui/PageTitle'
import { Spinner } from '@/shared/ui/Spinner'

/** Agendamentos ainda por vir (antes do check-in): mostram os avisos da avaliação. */
const UPCOMING_STATUS: AppointmentDto['status'][] = ['ELIGIBILITY_CONFIRMED', 'CONFIRMED']

/** Mesma regra do back: o doador cancela antes do check-in e antes do horário. */
const CANCELABLE_STATUS: AppointmentDto['status'][] = ['SCHEDULED', 'ELIGIBILITY_CONFIRMED', 'CONFIRMED']

// Mesmo limite mínimo do back (CancelAppointmentDto#cancellationReason,
// quando informado) - validar aqui evita mandar a requisição só para
// receber 400 de volta quando o doador digita 1-2 caracteres.
const REASON_MIN_LENGTH = 3

export function MyAppointmentsPage() {
  usePageTitle('Meus agendamentos')
  const appointments = useMyAppointments()
  const profile = useMyProfile()
  const units = useUnits()
  const cancel = useCancelAppointment()
  const confirm = useConfirmAttendance()
  const location = useLocation()
  const navigate = useNavigate()
  // Resultado da avaliação do agendamento recém-criado (enviado pela SchedulePage). Fica guardado
  // no estado da página e sai do histórico do navegador logo em seguida, para não reaparecer ao
  // recarregar a página ou voltar a ela.
  const [scheduleResult, setScheduleResult] = useState(
    () => (location.state as ScheduleResultState | null)?.createdAppointment ?? null,
  )
  useEffect(() => {
    if (location.state) {
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.state, location.pathname, navigate])
  // Atualiza a cada minuto: "Confirmar presença" some quando o horário do agendamento passa.
  const now = useNow()
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [errorReason, setErrorReason] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  function openConfirmation(id: string) {
    setConfirmingId(id)
    setReason('')
    setErrorReason(null)
    cancel.reset()
  }

  function closeConfirmation() {
    setConfirmingId(null)
    setReason('')
    setErrorReason(null)
  }

  function confirmCancellation(id: string) {
    const trimmedReason = reason.trim()
    if (trimmedReason.length > 0 && trimmedReason.length < REASON_MIN_LENGTH) {
      setErrorReason(`O motivo deve ter pelo menos ${REASON_MIN_LENGTH} caracteres, ou fique em branco.`)
      return
    }
    setErrorReason(null)
    cancel.mutate(
      { id, cancellationReason: trimmedReason.length > 0 ? trimmedReason : undefined },
      { onSuccess: closeConfirmation },
    )
  }

  if (appointments.isLoading) {
    return <Spinner label="Carregando seus agendamentos..." />
  }

  // Em aberto (por vir ou com check-in feito) primeiro; o resto vira histórico, do mais recente
  // para o mais antigo. Assim cancelamentos de teste não empurram o agendamento ativo para baixo.
  const all = appointments.data ?? []
  const open = all.filter((a) => isOpenForDonor(a, now)).sort((a, b) => a.dateTime.localeCompare(b.dateTime))
  const history = all.filter((a) => !isOpenForDonor(a, now)).sort((a, b) => b.dateTime.localeCompare(a.dateTime))

  function renderAppointment(appointment: AppointmentDto) {
    return (
      <Card key={appointment.id} className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-slate-900">{unitLabel(units.data, appointment.collectionUnitId)}</p>
            <p className="text-sm text-slate-500">{formatDateTime(appointment.dateTime)}</p>
            {appointment.status === 'CONFIRMED' && appointment.confirmedAt && (
              <p className="mt-1 text-sm text-slate-500">
                Presença confirmada em {formatDateTime(appointment.confirmedAt)}
              </p>
            )}
            {/* Avisos da avaliação (ex.: menor deve levar o termo do responsável), enquanto o
                agendamento ainda está por vir. */}
            {UPCOMING_STATUS.includes(appointment.status) &&
              appointment.eligibilityNotices.map((notice) => (
                <p key={notice} className="mt-1 text-sm font-medium text-amber-700">
                  {ASSESSMENT_NOTICE_LABEL[notice]}
                </p>
              ))}
            {appointment.status === 'CANCELED' && appointment.cancellationReason && (
              <p className="mt-1 text-sm text-slate-500">
                Motivo: <span className="italic">{appointment.cancellationReason}</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AppointmentStatusBadge status={appointment.status} />
            {canConfirmAttendance(appointment, now) && (
              <Button
                loading={confirm.isPending && confirm.variables === appointment.id}
                onClick={() => confirm.mutate(appointment.id)}
              >
                Confirmar presença
              </Button>
            )}
            {/* O botão fica no lugar com a pergunta aberta (a linha não se mexe); clicar de novo fecha. */}
            {CANCELABLE_STATUS.includes(appointment.status) && new Date(appointment.dateTime).getTime() > now && (
              <Button
                variant="danger"
                aria-expanded={confirmingId === appointment.id}
                onClick={() =>
                  confirmingId === appointment.id ? closeConfirmation() : openConfirmation(appointment.id)
                }
              >
                Cancelar
              </Button>
            )}
          </div>
        </div>

        {confirm.variables === appointment.id && (
          <ErrorAlert error={confirm.error} fallback="Não foi possível confirmar sua presença." />
        )}

        {confirmingId === appointment.id && (
          <ConfirmBox question="Cancelar este agendamento?">
            <TextareaField
              label="Motivo (opcional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              error={errorReason ?? undefined}
              rows={2}
            />
            <ErrorAlert error={cancel.error} fallback="Não foi possível cancelar." />
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="danger" loading={cancel.isPending} onClick={() => confirmCancellation(appointment.id)}>
                Confirmar cancelamento
              </Button>
              <Button variant="ghost" disabled={cancel.isPending} onClick={closeConfirmation}>
                Voltar
              </Button>
            </div>
          </ConfirmBox>
        )}
      </Card>
    )
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <PageTitle className="">Meus agendamentos</PageTitle>
        {/* Só um agendamento em aberto por vez: com um marcado, o botão não levaria a nada. */}
        {appointments.data && open.length === 0 && <ButtonLink to="/schedule">Agendar nova doação</ButtonLink>}
      </div>

      {scheduleResult && (
        <div className="mb-6">
          <ScheduleResultAlert appointment={scheduleResult} onClose={() => setScheduleResult(null)} />
        </div>
      )}

      {/* Campanhas que pedem o tipo sanguíneo do doador (só aparece quando há alguma). */}
      <div className="mb-6">
        <CampaignsForYou bloodType={profile.data?.bloodType ?? null} />
      </div>

      <ErrorAlert error={appointments.error} fallback="Não foi possível carregar seus agendamentos." className="mb-6" />

      {appointments.data?.length === 0 && (
        <Card>
          <p className="text-slate-500">Você ainda não tem nenhum agendamento.</p>
        </Card>
      )}

      {open.length > 0 && (
        <section aria-labelledby="em-aberto" className="mb-8">
          <h2 id="em-aberto" className="mb-3 text-lg font-semibold text-slate-900">
            Em aberto
          </h2>
          <div className="flex flex-col gap-3">{open.map(renderAppointment)}</div>
        </section>
      )}

      {history.length > 0 && (
        // Histórico fechado por padrão: o que importa é o agendamento em aberto; os antigos só sob pedido.
        <section aria-labelledby="historico">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 id="historico" className="text-lg font-semibold text-slate-900">
              Histórico
            </h2>
            <Button
              variant="secondary"
              aria-expanded={showHistory}
              aria-controls="lista-historico"
              onClick={() => setShowHistory((open) => !open)}
            >
              {showHistory ? 'Ocultar histórico' : `Ver histórico (${history.length})`}
            </Button>
          </div>
          {showHistory && (
            <div id="lista-historico" className="flex flex-col gap-3">
              {history.map(renderAppointment)}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
