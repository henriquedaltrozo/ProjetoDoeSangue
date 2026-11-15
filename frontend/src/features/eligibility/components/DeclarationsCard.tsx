import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { useUpdateProfile } from '@/features/eligibility/hooks/useEligibility'
import { updateDeclarationsSchema } from '@/features/eligibility/schemas'
import { ageFromBirthDate, declarationsForAge } from '@/shared/lib/age'
import { businessDate, formatDate } from '@/shared/lib/format'
import type { DonorResponseDto } from '@/shared/types'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { ErrorAlert } from '@/shared/ui/ErrorAlert'
import { InputField, SelectField } from '@/shared/ui/Field'

type FormInput = z.input<typeof updateDeclarationsSchema>
type FormOutput = z.output<typeof updateDeclarationsSchema>

const answer = (value: boolean | null) => (value === null ? '' : value ? 'yes' : 'no')

function clearanceText(donor: DonorResponseDto): string {
  if (!donor.medicalClearanceAt || !donor.medicalClearanceValidUntil) {
    return 'ainda não registrada (após os 70 anos, só é possível doar depois dela)'
  }
  const validUntil = formatDate(donor.medicalClearanceValidUntil)
  return donor.medicalClearanceValidUntil < businessDate()
    ? `vencida em ${validUntil}; procure o hemocentro para uma nova avaliação`
    : `favorável, registrada em ${formatDate(donor.medicalClearanceAt)} e válida até ${validUntil}`
}

/**
 * Declarações que o doador faz porque o sistema não tem o histórico dele: responsável legal (menores
 * de 18), doação antes dos 60 (60 anos ou mais) e doador regular (70 ou mais). Só aparece quando há
 * algo a declarar para a idade.
 */
export function DeclarationsCard({ donor }: { donor: DonorResponseDto }) {
  const required = declarationsForAge(ageFromBirthDate(donor.birthDate))
  const update = useUpdateProfile(donor.id)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(updateDeclarationsSchema) })

  useEffect(() => {
    reset({
      ...(required.guardian && {
        guardianName: donor.guardianName ?? '',
        guardianConsent: donor.guardianConsentDeclared,
      }),
      ...(required.donatedBefore60 && { donatedBefore60: answer(donor.donatedBefore60) }),
      ...(required.regularDonor && { regularDonor: answer(donor.regularDonorDeclared) }),
    })
  }, [donor, reset, required.guardian, required.donatedBefore60, required.regularDonor])

  if (!required.guardian && !required.donatedBefore60 && !required.regularDonor) {
    return null
  }

  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold text-slate-900">Minhas declarações</h2>
      <Card>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit((values) => update.mutate(values))}>
          {required.guardian && (
            <>
              <InputField
                label="Nome do responsável legal"
                error={errors.guardianName?.message}
                {...register('guardianName')}
              />
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" className="mt-1" {...register('guardianConsent')} />
                <span>
                  Vou apresentar, no dia da doação, o termo de consentimento assinado pelo meu responsável legal.
                </span>
              </label>
            </>
          )}
          {required.donatedBefore60 && (
            <SelectField
              label="Você já doou sangue antes dos 60 anos?"
              error={errors.donatedBefore60?.message}
              {...register('donatedBefore60')}
            >
              <option value="">Não respondido</option>
              <option value="yes">Sim</option>
              <option value="no">Não</option>
            </SelectField>
          )}
          {required.regularDonor && (
            <>
              <SelectField
                label="Você é doador voluntário regular?"
                error={errors.regularDonor?.message}
                {...register('regularDonor')}
              >
                <option value="">Não respondido</option>
                <option value="yes">Sim</option>
                <option value="no">Não</option>
              </SelectField>
              <p className="text-sm text-slate-600">Avaliação médica do hemocentro: {clearanceText(donor)}</p>
            </>
          )}

          <ErrorAlert error={update.error} fallback="Não foi possível salvar suas declarações." />
          {update.isSuccess && !isDirty && (
            <Alert variant="success" onClose={() => update.reset()}>
              Declarações salvas.
            </Alert>
          )}

          <Button type="submit" loading={update.isPending}>
            Salvar declarações
          </Button>
        </form>
      </Card>
    </div>
  )
}
