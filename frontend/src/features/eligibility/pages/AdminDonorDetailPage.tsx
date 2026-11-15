import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { DataRow } from '@/features/eligibility/components/DataRow'
import { EligibilityStatusCard } from '@/features/eligibility/components/EligibilityStatusCard'
import { PermanentUnfitnessCard } from '@/features/eligibility/components/PermanentUnfitnessCard'
import { TemporaryUnfitnessForm } from '@/features/eligibility/components/TemporaryUnfitnessForm'
import {
  useDeleteUnfitness,
  useDonor,
  useDonorAudit,
  useDonorUnfitness,
  useEndUnfitness,
  useMedicalClearance,
} from '@/features/eligibility/hooks/useEligibility'
import { isUnfitnessActive } from '@/features/eligibility/lib/unfitness'
import { ageFromBirthDate, declarationsForAge, formatBirthDateWithAge } from '@/shared/lib/age'
import { businessDate, formatCpf, formatDate, formatDateTime } from '@/shared/lib/format'
import { formatPhone } from '@/shared/lib/masks'
import { usePageTitle } from '@/shared/lib/usePageTitle'
import { AUDIT_ACTION_LABEL, ROLE_LABEL, SEX_LABEL, UNFITNESS_CATEGORY_LABEL } from '@/shared/types'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { ConfirmPrompt } from '@/shared/ui/ConfirmPrompt'
import { ErrorAlert } from '@/shared/ui/ErrorAlert'
import { PageTitle } from '@/shared/ui/PageTitle'
import { Spinner } from '@/shared/ui/Spinner'

/**
 * Volta para a tela de onde o admin veio (agendamentos ou lista de doadores). Se a página foi aberta
 * direto pelo endereço, não há tela anterior no app: vai para a lista de doadores.
 */
function BackButton() {
  const navigate = useNavigate()
  // "default" é a chave da primeira entrada do histórico: não há tela anterior dentro do app.
  const hasPreviousPage = useLocation().key !== 'default'
  return (
    <button
      type="button"
      className="mb-4 inline-block text-sm text-red-600 hover:underline"
      onClick={() => (hasPreviousPage ? navigate(-1) : navigate('/admin/donors'))}
    >
      ← Voltar
    </button>
  )
}

export function AdminDonorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const donorId = id as string
  const donor = useDonor(donorId)
  usePageTitle(donor.data?.completeName ?? 'Doador')
  const unfitness = useDonorUnfitness(donorId)
  const [showAudit, setShowAudit] = useState(false)
  const [showUnfitnessForm, setShowUnfitnessForm] = useState(false)
  // Inaptidão cuja exclusão está sendo confirmada (a pergunta aparece embaixo dela, na largura toda).
  const [askingDeleteId, setAskingDeleteId] = useState<string | null>(null)
  const [unfitnessRegistered, setUnfitnessRegistered] = useState(false)
  const audit = useDonorAudit(donorId, showAudit)
  const endUnfitness = useEndUnfitness(donorId)
  const deleteUnfitness = useDeleteUnfitness(donorId)
  const medicalClearance = useMedicalClearance(donorId)

  if (donor.isLoading) {
    return <Spinner label="Carregando doador..." />
  }
  if (!donor.data) {
    return (
      <div>
        <BackButton />
        <ErrorAlert error={donor.error ?? true} fallback="Não foi possível carregar o doador." />
      </div>
    )
  }

  const d = donor.data
  const required = declarationsForAge(ageFromBirthDate(d.birthDate))
  const today = businessDate()
  const clearanceExpired = d.medicalClearanceValidUntil !== null && d.medicalClearanceValidUntil < today
  const yesNo = (value: boolean | null) => (value === null ? 'Não respondido' : value ? 'Sim' : 'Não')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackButton />
        <PageTitle className="">{d.completeName}</PageTitle>
      </div>

      <EligibilityStatusCard donorId={donorId} audience="admin" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Esquerda: quem é o doador (e a avaliação médica, quando a idade pede). */}
        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Dados do doador</h2>
            <DataRow label="CPF" value={formatCpf(d.cpf)} />
            <DataRow label="Data de nascimento" value={formatBirthDateWithAge(d.birthDate)} />
            <DataRow label="Sexo" value={SEX_LABEL[d.sex]} />
            <DataRow label="Telefone" value={d.phone ? formatPhone(d.phone) : 'Não informado'} />
            <DataRow label="E-mail" value={d.email} />
            <DataRow label="Peso" value={`${d.weightKg} kg`} />
            <DataRow label="Tipo sanguíneo" value={d.bloodType ?? 'Não informado'} />
            <DataRow label="Última doação" value={d.lastDonationAt ? formatDate(d.lastDonationAt) : 'Nunca doou'} />
            {required.guardian && (
              <DataRow
                label="Responsável legal"
                value={
                  d.guardianName
                    ? `${d.guardianName}${d.guardianConsentDeclared ? ' (termo confirmado)' : ' (termo não confirmado)'}`
                    : 'Não informado'
                }
              />
            )}
            {required.donatedBefore60 && <DataRow label="Doou antes dos 60" value={yesNo(d.donatedBefore60)} />}
            {required.regularDonor && <DataRow label="Doador regular" value={yesNo(d.regularDonorDeclared)} />}
          </Card>

          {required.regularDonor && (
            <Card>
              <h2 className="mb-3 text-lg font-semibold text-slate-900">Avaliação médica (70 anos ou mais)</h2>
              <p className="mb-3 text-sm text-slate-600">
                {d.medicalClearanceAt && d.medicalClearanceValidUntil
                  ? clearanceExpired
                    ? `A avaliação de ${formatDate(d.medicalClearanceAt)} venceu em ${formatDate(d.medicalClearanceValidUntil)}: registre uma nova depois de reavaliar o doador.`
                    : `Avaliação favorável registrada em ${formatDate(d.medicalClearanceAt)}, válida até ${formatDate(d.medicalClearanceValidUntil)}.`
                  : d.regularDonorDeclared
                    ? 'Doador regular aguardando a avaliação médica do serviço de hemoterapia.'
                    : 'O doador não declarou ser doador regular: a avaliação não pode ser registrada.'}
              </p>
              <ErrorAlert
                error={medicalClearance.register.error ?? medicalClearance.revoke.error}
                fallback="Não foi possível atualizar a avaliação médica."
                className="mb-3"
              />
              <div className="flex flex-wrap gap-2">
                {(!d.medicalClearanceAt || clearanceExpired) && (
                  <Button
                    disabled={!d.regularDonorDeclared}
                    loading={medicalClearance.register.isPending}
                    onClick={() => medicalClearance.register.mutate()}
                  >
                    {d.medicalClearanceAt
                      ? 'Registrar nova avaliação favorável'
                      : 'Registrar avaliação médica favorável'}
                  </Button>
                )}
                {d.medicalClearanceAt && (
                  <Button
                    variant="secondary"
                    loading={medicalClearance.revoke.isPending}
                    onClick={() => medicalClearance.revoke.mutate()}
                  >
                    Desfazer avaliação
                  </Button>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Direita: o que impede (ou impediu) o doador de doar, e as ações sobre isso. */}
        <div className="flex flex-col gap-6">
          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Inaptidões temporárias</h2>
              {!showUnfitnessForm && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setUnfitnessRegistered(false)
                    setShowUnfitnessForm(true)
                  }}
                >
                  Registrar inaptidão
                </Button>
              )}
            </div>

            {showUnfitnessForm && (
              <div className="mb-4">
                <TemporaryUnfitnessForm
                  donorId={donorId}
                  onRegistered={() => {
                    setShowUnfitnessForm(false)
                    setUnfitnessRegistered(true)
                  }}
                  onCancel={() => setShowUnfitnessForm(false)}
                />
              </div>
            )}

            {unfitnessRegistered && !showUnfitnessForm && (
              <div className="mb-3">
                <Alert variant="success" onClose={() => setUnfitnessRegistered(false)}>
                  Inaptidão registrada.
                </Alert>
              </div>
            )}
            {unfitness.isLoading && <Spinner label="Carregando inaptidões..." />}
            <ErrorAlert error={unfitness.error} fallback="Não foi possível carregar as inaptidões." className="mb-3" />
            <ErrorAlert error={endUnfitness.error} fallback="Não foi possível encerrar a inaptidão." className="mb-3" />
            <ErrorAlert
              error={deleteUnfitness.error}
              fallback="Não foi possível excluir a inaptidão."
              className="mb-3"
            />
            {unfitness.data?.length === 0 && <p className="text-sm text-slate-500">Nenhuma inaptidão registrada.</p>}
            <ul className="divide-y divide-slate-100">
              {unfitness.data?.map((i) => (
                <li key={i.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{i.reason}</p>
                      <p className="text-sm text-slate-500">
                        {UNFITNESS_CATEGORY_LABEL[i.category]} - desde {formatDate(i.startDate)}
                        {i.expectedEndDate && ` até ${formatDate(i.expectedEndDate)}`}
                      </p>
                      {i.actualEndDate && (
                        <p className="text-xs text-emerald-600">
                          Encerrada antecipadamente em {formatDate(i.actualEndDate)}
                        </p>
                      )}
                      {!i.actualEndDate && !isUnfitnessActive(i, today) && (
                        <p className="text-xs text-slate-500">
                          {i.startDate > today ? `Começa em ${formatDate(i.startDate)}` : 'Já terminou'}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-start gap-2">
                      {/* Só uma inaptidão em vigor pode ser encerrada (o backend recusa as terminadas e as futuras). */}
                      {!i.actualEndDate && isUnfitnessActive(i, today) && (
                        <Button
                          variant="secondary"
                          loading={endUnfitness.isPending && endUnfitness.variables === i.id}
                          onClick={() => {
                            deleteUnfitness.reset()
                            endUnfitness.mutate(i.id)
                          }}
                        >
                          Encerrar antecipadamente
                        </Button>
                      )}
                      {/* Excluir é para registro feito por engano; encerrar mantém o histórico. */}
                      <Button
                        variant="ghost"
                        aria-expanded={askingDeleteId === i.id}
                        loading={deleteUnfitness.isPending && deleteUnfitness.variables === i.id}
                        onClick={() => setAskingDeleteId(askingDeleteId === i.id ? null : i.id)}
                      >
                        Excluir
                      </Button>
                    </div>
                  </div>
                  {askingDeleteId === i.id && (
                    <ConfirmPrompt
                      question="Excluir esta inaptidão? Use só se ela foi registrada por engano."
                      confirmLabel="Confirmar exclusão"
                      onConfirm={() => {
                        setAskingDeleteId(null)
                        endUnfitness.reset()
                        deleteUnfitness.mutate(i.id)
                      }}
                      onCancel={() => setAskingDeleteId(null)}
                    />
                  )}
                </li>
              ))}
            </ul>
          </Card>

          <PermanentUnfitnessCard donor={d} />
        </div>
      </div>

      {/* Final da tela: o log de auditoria só é buscado e mostrado quando o admin pede. */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Log de auditoria de acesso</h2>
            <p className="text-sm text-slate-500">Registro de quem visualizou ou alterou este perfil (LGPD).</p>
          </div>
          <Button variant="secondary" aria-expanded={showAudit} onClick={() => setShowAudit((open) => !open)}>
            {showAudit ? 'Ocultar log' : 'Ver log de auditoria'}
          </Button>
        </div>
        {showAudit && (
          <div className="mt-4">
            {audit.isLoading && <Spinner label="Carregando histórico de acesso..." />}
            <ErrorAlert error={audit.error} fallback="Não foi possível carregar o log de auditoria." className="mb-3" />
            {audit.data?.length === 0 && <p className="text-sm text-slate-500">Nenhum acesso registrado ainda.</p>}
            <div className="flex max-h-80 flex-col overflow-y-auto">
              {audit.data?.map((record) => (
                <div
                  key={record.id}
                  className="flex flex-col gap-0.5 border-b border-slate-100 py-2 text-sm last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                >
                  <div>
                    <p className="font-medium text-slate-900">{AUDIT_ACTION_LABEL[record.action]}</p>
                    <p className="text-xs text-slate-500">
                      {ROLE_LABEL[record.userRole]}
                      {record.userId ? ` (${record.userId.slice(0, 8)}...)` : ' (sistema)'}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400">{formatDateTime(record.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
