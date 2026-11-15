import { useState } from 'react'
import type { NotificationStatus, SentNotificationDto } from '@/features/notifications/api/notifications.api'
import {
  useFailedJobs,
  useRetryFailedJob,
  useSentNotifications,
  useSuppressed,
  useUnblockRecipient,
} from '@/features/notifications/hooks/useNotifications'
import { formatDateTime } from '@/shared/lib/format'
import { usePageTitle } from '@/shared/lib/usePageTitle'
import { Badge, type BadgeTone } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { ErrorAlert } from '@/shared/ui/ErrorAlert'
import { SelectField } from '@/shared/ui/Field'
import { PageTitle } from '@/shared/ui/PageTitle'
import { Spinner } from '@/shared/ui/Spinner'

/** Nome de cada tipo de e-mail como aparece na tela. */
export const TYPE_LABELS: Record<string, string> = {
  'reminder-24h': 'Lembrete',
  'attendance-confirmation': 'Pedido de confirmação',
  'appointment-booked': 'Agendamento confirmado',
  'appointment-canceled': 'Agendamento cancelado',
  'no-show': 'Aviso de falta',
  'interval-completed': 'Obrigado por doar',
  'eligible-again': 'Já pode doar',
  'urgent-campaign': 'Campanha urgente',
  welcome: 'Boas-vindas',
  'email-verification': 'Confirmação de e-mail',
  'reset-password': 'Redefinição de senha',
  'password-changed': 'Senha alterada',
  'email-changed': 'E-mail alterado',
  'erase-personal-data': 'Exclusão de dados (LGPD)',
}

const typeLabel = (type: string) => TYPE_LABELS[type] ?? type

const STATUS: Record<NotificationStatus, { label: string; tone: BadgeTone }> = {
  SENT: { label: 'Enviado', tone: 'success' },
  FAILURE: { label: 'Falhou', tone: 'danger' },
  SUPPRESSED: { label: 'Bloqueado', tone: 'warning' },
}

const REASON_LABELS: Record<string, string> = {
  hard_bounce: 'endereço inexistente',
  hardbounce: 'endereço inexistente',
  invalid_email: 'endereço inválido',
  blocked: 'recusado pelo provedor',
  spam: 'marcou como spam',
  complaint: 'marcou como spam',
}

/** [admin] Acompanhamento dos e-mails: falhas definitivas, endereços bloqueados e o registro de envios. */
export function AdminNotificationsPage() {
  usePageTitle('E-mails')
  return (
    <div className="flex flex-col gap-8">
      <PageTitle className="mb-0">E-mails</PageTitle>
      <FailedJobsSection />
      <SuppressedSection />
      <SentSection />
    </div>
  )
}

function FailedJobsSection() {
  const failed = useFailedJobs()
  const retry = useRetryFailedJob()
  return (
    <section aria-labelledby="failed-jobs" className="flex flex-col gap-3">
      <h2 id="failed-jobs" className="text-xl font-bold text-slate-900">
        Falhas definitivas
      </h2>
      <p className="text-sm text-slate-600">
        E-mails que esgotaram as tentativas (cerca de 4 horas). Corrija a causa (ex.: o SMTP) e reenvie: quem já recebeu
        não recebe de novo. Ficam disponíveis por 7 dias.
      </p>
      <ErrorAlert error={failed.error ?? retry.error} fallback="Não foi possível carregar as falhas." />
      {failed.isLoading && <Spinner />}
      {failed.data?.length === 0 && <p className="text-sm text-slate-500">Nenhuma falha. Tudo certo.</p>}
      {failed.data?.map((job) => (
        <Card key={job.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-medium text-slate-900">{typeLabel(job.type)}</p>
            <p className="break-words text-sm text-red-700">{job.failedReason || 'Sem motivo registrado.'}</p>
            <p className="text-xs text-slate-500">
              {job.attemptsMade} tentativa(s){job.failedAt && ` · última em ${formatDateTime(job.failedAt)}`}
            </p>
          </div>
          <Button
            variant="secondary"
            loading={retry.isPending && retry.variables === job.id}
            onClick={() => retry.mutate(job.id)}
          >
            Reenviar
          </Button>
        </Card>
      ))}
    </section>
  )
}

function SuppressedSection() {
  const suppressed = useSuppressed()
  const unblock = useUnblockRecipient()
  return (
    <section aria-labelledby="suppressed" className="flex flex-col gap-3">
      <h2 id="suppressed" className="text-xl font-bold text-slate-900">
        Endereços bloqueados
      </h2>
      <p className="text-sm text-slate-600">
        O provedor avisou que estes endereços não existem, recusaram ou marcaram nossos e-mails como spam: eles não
        recebem mais nada. Desbloqueie se o doador corrigiu o endereço.
      </p>
      <ErrorAlert error={suppressed.error ?? unblock.error} fallback="Não foi possível carregar os bloqueios." />
      {suppressed.isLoading && <Spinner />}
      {suppressed.data?.length === 0 && <p className="text-sm text-slate-500">Nenhum endereço bloqueado.</p>}
      {suppressed.data?.map((s) => (
        <Card key={s.email} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="break-all font-medium text-slate-900">{s.email}</p>
            <p className="text-sm text-slate-500">
              {REASON_LABELS[s.reason] ?? s.reason} · desde {formatDateTime(s.createdAt)}
            </p>
          </div>
          <Button
            variant="secondary"
            loading={unblock.isPending && unblock.variables === s.email}
            onClick={() => unblock.mutate(s.email)}
          >
            Desbloquear
          </Button>
        </Card>
      ))}
    </section>
  )
}

function SentSection() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<NotificationStatus | ''>('')
  const sent = useSentNotifications(page, status || undefined)
  const totalPages = sent.data ? Math.max(1, Math.ceil(sent.data.total / sent.data.pageSize)) : 1

  return (
    <section aria-labelledby="sent" className="flex flex-col gap-3">
      <h2 id="sent" className="text-xl font-bold text-slate-900">
        Registro de envios
      </h2>
      <div className="sm:max-w-xs">
        <SelectField
          label="Situação"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as NotificationStatus | '')
            setPage(1)
          }}
        >
          <option value="">Todas</option>
          <option value="SENT">Enviados</option>
          <option value="FAILURE">Com falha</option>
          <option value="SUPPRESSED">Bloqueados</option>
        </SelectField>
      </div>
      <ErrorAlert error={sent.error} fallback="Não foi possível carregar o registro de envios." />
      {sent.isLoading && <Spinner />}
      {sent.data && (
        <p className="text-sm text-slate-500">{sent.data.total} envio(s) · os registros ficam guardados por 180 dias</p>
      )}
      {sent.data?.items.map((item) => (
        <SentItem key={item.id} item={item} />
      ))}
      {totalPages > 1 && (
        <nav aria-label="Páginas do registro" className="flex items-center justify-between gap-3">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ← Anterior
          </Button>
          <span className="text-sm text-slate-500">
            Página {page} de {totalPages}
          </span>
          <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Próxima →
          </Button>
        </nav>
      )}
    </section>
  )
}

function SentItem({ item }: { item: SentNotificationDto }) {
  const status = STATUS[item.status]
  return (
    <Card className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={status.tone}>{status.label}</Badge>
        <span className="font-medium text-slate-900">{typeLabel(item.type)}</span>
        <span className="text-sm text-slate-500">para {item.recipient}</span>
      </div>
      <p className="text-sm text-slate-600">{item.subject}</p>
      {item.error && <p className="break-words text-sm text-red-700">{item.error}</p>}
      {item.sentAt && <p className="text-xs text-slate-500">{formatDateTime(item.sentAt)}</p>}
    </Card>
  )
}
