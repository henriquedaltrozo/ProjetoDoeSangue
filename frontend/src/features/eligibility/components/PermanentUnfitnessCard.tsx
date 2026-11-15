import { useState } from 'react'
import { usePermanentUnfitness } from '@/features/eligibility/hooks/useEligibility'
import { OTHER_REASON, PERMANENT_REASONS } from '@/features/eligibility/lib/unfitness-reasons'
import type { DonorResponseDto } from '@/shared/types'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { ConfirmButton } from '@/shared/ui/ConfirmButton'
import { ErrorAlert } from '@/shared/ui/ErrorAlert'
import { SelectField, TextareaField } from '@/shared/ui/Field'

const REASON_MIN_LENGTH = 3

/**
 * [admin] Inaptidão permanente: registrar (no mesmo formato da temporária: um botão abre o
 * formulário; o motivo vem de uma lista de motivos comuns, ou "Outro" para descrever; pede
 * confirmação, porque impede o doador de doar) ou desfazer um registro feito por engano.
 */
export function PermanentUnfitnessCard({ donor }: { donor: DonorResponseDto }) {
  const permanent = usePermanentUnfitness(donor.id)
  const [open, setOpen] = useState(false)
  const [choice, setChoice] = useState('')
  const [otherReason, setOtherReason] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)
  const isOther = choice === OTHER_REASON

  function close() {
    setOpen(false)
    setChoice('')
    setOtherReason('')
    setReasonError(null)
  }

  const reason = isOther ? otherReason.trim() : choice

  /** Confere o motivo antes de pedir a confirmação (sem motivo, mostra o erro no campo). */
  function validateReason(): boolean {
    if (reason.length < REASON_MIN_LENGTH) {
      setReasonError(isOther ? 'Descreva o motivo da inaptidão permanente.' : 'Escolha o motivo.')
      return false
    }
    setReasonError(null)
    return true
  }

  function confirmRegister() {
    permanent.register.mutate(reason, { onSuccess: close })
  }

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Inaptidão permanente</h2>
        {!donor.permanentUnfit && !open && (
          <Button
            variant="secondary"
            onClick={() => {
              permanent.register.reset()
              setOpen(true)
            }}
          >
            Registrar inaptidão
          </Button>
        )}
      </div>
      <ErrorAlert
        error={permanent.register.error ?? permanent.revoke.error}
        fallback="Não foi possível atualizar a inaptidão permanente."
        className="mb-3"
      />
      {donor.permanentUnfit ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-600">
            O doador está registrado como <strong>inapto permanente</strong> e não pode doar.
            {donor.permanentUnfitnessReason && (
              <>
                {' '}
                Motivo: <span className="italic">{donor.permanentUnfitnessReason}</span>
              </>
            )}
          </p>
          <div>
            <ConfirmButton
              variant="secondary"
              question="Desfazer a inaptidão permanente? Use só se ela foi registrada por engano."
              confirmLabel="Confirmar e desfazer"
              loading={permanent.revoke.isPending}
              onConfirm={() => permanent.revoke.mutate()}
            >
              Desfazer (registrada por engano)
            </ConfirmButton>
          </div>
        </div>
      ) : !open ? (
        <p className="text-sm text-slate-500">
          Nenhuma inaptidão permanente registrada. Use para condições que impedem a doação para sempre.
        </p>
      ) : (
        <div className="flex flex-col gap-4 rounded-lg border border-slate-200 p-4">
          <SelectField
            label="Motivo"
            value={choice}
            onChange={(e) => {
              setChoice(e.target.value)
              setReasonError(null)
            }}
            error={!isOther ? (reasonError ?? undefined) : undefined}
          >
            <option value="">Selecione</option>
            {PERMANENT_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
            <option value={OTHER_REASON}>Outro (descrever)</option>
          </SelectField>
          {isOther && (
            <TextareaField
              label="Descreva o motivo"
              rows={2}
              value={otherReason}
              onChange={(e) => setOtherReason(e.target.value)}
              error={reasonError ?? undefined}
            />
          )}
          <div className="flex flex-wrap items-start gap-2">
            <ConfirmButton
              variant="primary"
              question="Registrar a inaptidão permanente? O doador não poderá mais doar."
              confirmLabel="Confirmar registro"
              loading={permanent.register.isPending}
              validate={validateReason}
              onConfirm={confirmRegister}
            >
              Registrar
            </ConfirmButton>
            <Button variant="ghost" disabled={permanent.register.isPending} onClick={close}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
