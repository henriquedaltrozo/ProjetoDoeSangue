import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import type { z } from 'zod'
import { useRegisterUnfitness } from '@/features/eligibility/hooks/useEligibility'
import { expectedEndFor, OTHER_REASON, TEMPORARY_REASONS } from '@/features/eligibility/lib/unfitness-reasons'
import { registerUnfitnessSchema } from '@/features/eligibility/schemas'
import { businessDate } from '@/shared/lib/format'
import { UNFITNESS_CATEGORIES, UNFITNESS_CATEGORY_LABEL } from '@/shared/types'
import { Button } from '@/shared/ui/Button'
import { ErrorAlert } from '@/shared/ui/ErrorAlert'
import { InputField, SelectField } from '@/shared/ui/Field'

type FormInput = z.input<typeof registerUnfitnessSchema>
type FormOutput = z.output<typeof registerUnfitnessSchema>

interface TemporaryUnfitnessFormProps {
  donorId: string
  onRegistered: () => void
  onCancel: () => void
}

/**
 * [admin] Registro de inaptidão temporária. O motivo vem de uma lista de motivos comuns, que já
 * preenche a categoria e o fim previsto pelo prazo de referência (o admin pode ajustar); "Outro"
 * libera o texto livre.
 */
export function TemporaryUnfitnessForm({ donorId, onRegistered, onCancel }: TemporaryUnfitnessFormProps) {
  const registerUnfitness = useRegisterUnfitness(donorId)
  const [reasonId, setReasonId] = useState('')
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(registerUnfitnessSchema),
    defaultValues: { reason: '', category: 'CLINIC', startDate: businessDate(), expectedEndDate: '' },
  })
  const startDate = useWatch({ control, name: 'startDate' })
  const preset = TEMPORARY_REASONS.find((r) => r.id === reasonId)

  // Escolher um motivo da lista preenche o texto e a categoria; "Outro" limpa o texto para digitar.
  useEffect(() => {
    if (preset) {
      setValue('reason', preset.label, { shouldValidate: true })
      setValue('category', preset.category)
    } else if (reasonId === OTHER_REASON) {
      setValue('reason', '')
    }
  }, [preset, reasonId, setValue])

  // O fim previsto acompanha o prazo do motivo e a data de início (sem prazo fixo, fica em branco).
  useEffect(() => {
    if (!preset) return
    setValue('expectedEndDate', preset.duration && startDate ? expectedEndFor(startDate, preset.duration) : '')
  }, [preset, startDate, setValue])

  const isOther = reasonId === OTHER_REASON

  return (
    <form
      className="flex flex-col gap-4 rounded-lg border border-slate-200 p-4"
      onSubmit={handleSubmit((values) => registerUnfitness.mutate(values, { onSuccess: onRegistered }))}
    >
      <SelectField
        label="Motivo"
        value={reasonId}
        onChange={(e) => setReasonId(e.target.value)}
        error={!isOther ? errors.reason && 'Escolha o motivo.' : undefined}
        hint={preset ? `Prazo de referência: ${preset.rule}. Ajuste o fim previsto se o caso pedir.` : undefined}
      >
        <option value="">Selecione</option>
        {UNFITNESS_CATEGORIES.filter((c) => c !== 'OTHER').map((category) => (
          <optgroup key={category} label={UNFITNESS_CATEGORY_LABEL[category]}>
            {TEMPORARY_REASONS.filter((r) => r.category === category).map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </optgroup>
        ))}
        <option value={OTHER_REASON}>Outro (descrever)</option>
      </SelectField>

      {isOther ? (
        <InputField label="Descreva o motivo" error={errors.reason?.message} {...register('reason')} />
      ) : (
        <input type="hidden" {...register('reason')} />
      )}

      <SelectField label="Categoria" error={errors.category?.message} {...register('category')}>
        {UNFITNESS_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {UNFITNESS_CATEGORY_LABEL[category]}
          </option>
        ))}
      </SelectField>
      <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2">
        <InputField label="Data de início" type="date" error={errors.startDate?.message} {...register('startDate')} />
        <InputField
          label="Fim previsto (opcional)"
          type="date"
          error={errors.expectedEndDate?.message}
          {...register('expectedEndDate')}
        />
      </div>
      <ErrorAlert error={registerUnfitness.error} fallback="Não foi possível registrar a inaptidão." />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={registerUnfitness.isPending}>
          Registrar
        </Button>
        <Button variant="ghost" disabled={registerUnfitness.isPending} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
