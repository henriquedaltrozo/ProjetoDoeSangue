import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDonorNames } from '@/features/eligibility'
import { AppointmentStatusBadge } from '@/features/scheduling/components/AppointmentStatusBadge'
import {
  useAdminAppointments,
  useAllUnits,
  useCheckin,
  useComplete,
  useConfirmAttendance,
  useNoShow,
  useStaffCancel,
} from '@/features/scheduling/hooks/useScheduling'
import {
  awaitingConfirmation,
  canConfirmAttendance,
  EXPECTED_ATTENDANCE_STATUS,
} from '@/features/scheduling/lib/attendance'
import { unitLabel } from '@/features/scheduling/lib/units'
import { businessDate, formatDateTime } from '@/shared/lib/format'
import { useNow } from '@/shared/lib/useNow'
import { usePageTitle } from '@/shared/lib/usePageTitle'
import { APPOINTMENT_STATUS_LABEL, APPOINTMENT_STATUSES, type AppointmentStatus } from '@/shared/types'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { ConfirmPrompt } from '@/shared/ui/ConfirmPrompt'
import { ErrorAlert } from '@/shared/ui/ErrorAlert'
import { InputField, SelectField } from '@/shared/ui/Field'
import { PageTitle } from '@/shared/ui/PageTitle'
import { Spinner } from '@/shared/ui/Spinner'

/** A equipe também cancela depois do horário e depois do check-in (ex.: triagem clínica recusou). */
const STAFF_CANCELABLE_STATUS: AppointmentStatus[] = [
  'SCHEDULED',
  'ELIGIBILITY_CONFIRMED',
  'CONFIRMED',
  'CHECKIN_PERFORMED',
]

export function AdminAppointmentsPage() {
  usePageTitle('Agendamentos')
  const [status, setStatus] = useState<AppointmentStatus | ''>('')
  const [collectionUnitId, setCollectionUnitId] = useState('')
  // Começa no dia de hoje (Brasília): é o que a unidade precisa na recepção, e não carrega o
  // histórico inteiro a cada minuto. Limpar o campo mostra todos os dias.
  const [date, setDate] = useState(() => businessDate())

  // Lista completa (inclui desativadas): agendamentos antigos podem ser de uma unidade já desativada.
  const units = useAllUnits()
  const appointments = useAdminAppointments({
    status: status || undefined,
    collectionUnitId: collectionUnitId || undefined,
    date: date || undefined,
  })
  const checkin = useCheckin()
  const complete = useComplete()
  const noShow = useNoShow()
  const confirmAttendance = useConfirmAttendance()
  const donorNames = useDonorNames(appointments.data?.map((a) => a.donorId) ?? [])
  const staffCancel = useStaffCancel()

  // Cada ação limpa o resultado das outras antes de rodar: assim o erro exibido é sempre o da
  // última ação, e não um erro antigo de outro agendamento.
  const actions = [checkin, complete, noShow, confirmAttendance, staffCancel]
  // A ação que falhou (só uma por vez, porque cada uma limpa as outras) e o agendamento dela.
  const failed = actions.find((action) => action.error)
  const failedId = failed?.variables
  function run(action: (typeof actions)[number], appointmentId: string) {
    for (const other of actions) {
      other.reset()
    }
    action.mutate(appointmentId)
  }
  // Atualiza a cada minuto: a tela costuma ficar aberta o dia todo na unidade, e botões como
  // "Não compareceu" dependem de o horário do agendamento já ter passado.
  const now = useNow()
  // Pergunta aberta (cancelar ou não compareceu) e de qual agendamento. Ela aparece embaixo do
  // cartão, na largura toda, e não espremida ao lado dos botões.
  const [asking, setAsking] = useState<{ id: string; action: 'cancel' | 'noShow' } | null>(null)
  const isAsking = (id: string, action: 'cancel' | 'noShow') => asking?.id === id && asking.action === action
  // O botão continua no lugar enquanto a pergunta está aberta (nada na linha se mexe); clicar de
  // novo fecha a pergunta.
  const toggleAsking = (id: string, action: 'cancel' | 'noShow') =>
    setAsking(isAsking(id, action) ? null : { id, action })

  return (
    <div>
      <PageTitle>Agendamentos</PageTitle>

      <Card className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SelectField
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as AppointmentStatus | '')}
        >
          <option value="">Todos</option>
          {APPOINTMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {APPOINTMENT_STATUS_LABEL[s]}
            </option>
          ))}
        </SelectField>
        <SelectField label="Unidade" value={collectionUnitId} onChange={(e) => setCollectionUnitId(e.target.value)}>
          <option value="">Todas</option>
          {units.data?.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
              {!u.active && ' (desativada)'}
            </option>
          ))}
        </SelectField>
        <InputField label="Data" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Card>

      <ErrorAlert error={appointments.error} fallback="Não foi possível carregar os agendamentos." className="mb-4" />

      {appointments.isLoading && <Spinner label="Carregando agendamentos..." />}
      {appointments.data?.length === 0 && (
        <Card>
          <p className="text-slate-500">Nenhum agendamento encontrado para os filtros selecionados.</p>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {appointments.data?.map((appointment) => (
          <Card key={appointment.id} className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-slate-900">{unitLabel(units.data, appointment.collectionUnitId)}</p>
                <p className="text-sm text-slate-500">{formatDateTime(appointment.dateTime)}</p>
                {donorNames.get(appointment.donorId) && (
                  <p className="text-sm text-slate-700">{donorNames.get(appointment.donorId)}</p>
                )}
                <Link
                  to={`/admin/donors/${appointment.donorId}`}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  Ver doador
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <AppointmentStatusBadge status={appointment.status} />
                {appointment.eligibilityNotices.includes('BRING_GUARDIAN_CONSENT') && (
                  <Badge
                    tone="warning"
                    title="Doador menor de 18 anos: confira no check-in o termo de consentimento assinado pelo responsável legal."
                  >
                    Menor de 18 - conferir termo
                  </Badge>
                )}
                {awaitingConfirmation(appointment, now) && (
                  <Badge
                    tone="warning"
                    title="O pedido de confirmação já foi enviado e o doador não respondeu - considere ligar para ele."
                  >
                    Aguardando confirmação
                  </Badge>
                )}
                {canConfirmAttendance(appointment, now) && (
                  <Button
                    variant="secondary"
                    loading={confirmAttendance.isPending && confirmAttendance.variables === appointment.id}
                    onClick={() => run(confirmAttendance, appointment.id)}
                  >
                    Confirmar presença
                  </Button>
                )}
                {EXPECTED_ATTENDANCE_STATUS.includes(appointment.status) && (
                  <>
                    {/* Check-in só no dia do agendamento (mesma regra do backend, no dia de Brasília). */}
                    {businessDate(new Date(appointment.dateTime)) === businessDate(new Date(now)) && (
                      <Button
                        loading={checkin.isPending && checkin.variables === appointment.id}
                        onClick={() => run(checkin, appointment.id)}
                      >
                        Check-in
                      </Button>
                    )}
                    {new Date(appointment.dateTime).getTime() <= now && (
                      <Button
                        variant="danger"
                        aria-expanded={isAsking(appointment.id, 'noShow')}
                        loading={noShow.isPending && noShow.variables === appointment.id}
                        onClick={() => toggleAsking(appointment.id, 'noShow')}
                      >
                        Não compareceu
                      </Button>
                    )}
                  </>
                )}
                {appointment.status === 'CHECKIN_PERFORMED' && (
                  <Button
                    loading={complete.isPending && complete.variables === appointment.id}
                    onClick={() => run(complete, appointment.id)}
                  >
                    Concluir
                  </Button>
                )}
                {STAFF_CANCELABLE_STATUS.includes(appointment.status) && (
                  <Button
                    variant="danger"
                    aria-expanded={isAsking(appointment.id, 'cancel')}
                    loading={staffCancel.isPending && staffCancel.variables === appointment.id}
                    onClick={() => toggleAsking(appointment.id, 'cancel')}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
            {isAsking(appointment.id, 'noShow') && (
              <ConfirmPrompt
                question="Marcar que o doador não compareceu? O agendamento é encerrado."
                confirmLabel="Confirmar não comparecimento"
                loading={noShow.isPending && noShow.variables === appointment.id}
                onConfirm={() => {
                  setAsking(null)
                  run(noShow, appointment.id)
                }}
                onCancel={() => setAsking(null)}
              />
            )}
            {isAsking(appointment.id, 'cancel') && (
              <ConfirmPrompt
                question="Cancelar este agendamento? A vaga é liberada e os lembretes são removidos."
                confirmLabel="Confirmar cancelamento"
                loading={staffCancel.isPending && staffCancel.variables === appointment.id}
                onConfirm={() => {
                  setAsking(null)
                  run(staffCancel, appointment.id)
                }}
                onCancel={() => setAsking(null)}
              />
            )}
            {failedId === appointment.id && (
              <ErrorAlert error={failed?.error} fallback="Não foi possível concluir a ação neste agendamento." />
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
