import { useEligibilityCheck } from '@/features/eligibility/hooks/useEligibility'
import { formatDate } from '@/shared/lib/format'
import { ADMIN_INELIGIBILITY_REASON_LABEL, ASSESSMENT_NOTICE_LABEL, INELIGIBILITY_REASON_LABEL } from '@/shared/types'
import { Alert } from '@/shared/ui/Alert'
import { ErrorAlert } from '@/shared/ui/ErrorAlert'

interface EligibilityStatusCardProps {
  donorId: string
  /** Para quem é o texto: o próprio doador ("Você pode doar") ou o admin, sobre o doador. */
  audience?: 'donor' | 'admin'
}

const TEXT = {
  donor: {
    loading: 'Verificando se você pode doar...',
    error: 'Não foi possível verificar se você pode doar agora.',
    eligible: 'Você pode doar hoje',
    from: (date: string) => `Você poderá doar a partir de ${date}`,
    blocked: 'No momento você não pode doar',
    basis: 'Com base no seu cadastro e nas doações registradas. A triagem clínica no dia é feita pela unidade.',
    reasons: INELIGIBILITY_REASON_LABEL,
  },
  admin: {
    loading: 'Verificando a situação do doador...',
    error: 'Não foi possível verificar a situação do doador.',
    eligible: 'Pode doar hoje',
    from: (date: string) => `Poderá doar a partir de ${date}`,
    blocked: 'No momento não pode doar',
    basis: 'Com base no cadastro e nas doações registradas. A triagem clínica no dia é feita pela unidade.',
    reasons: ADMIN_INELIGIBILITY_REASON_LABEL,
  },
}

/**
 * Situação do doador para doar agora: pode doar hoje, ou a partir de quando e por quê. Calculada pelo
 * backend com as mesmas regras do agendamento; a triagem clínica no dia continua com a unidade.
 * Aparece em "Agendar doação" (para o doador) e no detalhe do doador (para o admin). Não tem botão
 * de atualizar: é refeita ao abrir a tela e sempre que os dados mudam (alterações do doador ou ações
 * do admin invalidam a consulta).
 */
export function EligibilityStatusCard({ donorId, audience = 'donor' }: EligibilityStatusCardProps) {
  const check = useEligibilityCheck(donorId)
  const text = TEXT[audience]

  if (check.isLoading) {
    return <p className="text-sm text-slate-500">{text.loading}</p>
  }
  if (!check.data) {
    return <ErrorAlert error={check.error ?? true} fallback={text.error} />
  }

  const result = check.data
  const eligible = result.result === 'ELIGIBLE'

  return (
    <section aria-label="Situação para doar">
      <Alert
        variant={eligible ? 'success' : 'warning'}
        title={
          eligible
            ? text.eligible
            : result.nextEligibilityDate
              ? text.from(formatDate(result.nextEligibilityDate))
              : text.blocked
        }
      >
        {!eligible && result.reasons.length > 0 && (
          <ul className="list-inside list-disc">
            {result.reasons.map((reason) => (
              <li key={reason}>{text.reasons[reason]}</li>
            ))}
          </ul>
        )}
        {result.notices.map((notice) => (
          <p key={notice} className="font-medium">
            {ASSESSMENT_NOTICE_LABEL[notice]}
          </p>
        ))}
        <p className="text-xs opacity-80">{text.basis}</p>
      </Alert>
    </section>
  )
}
