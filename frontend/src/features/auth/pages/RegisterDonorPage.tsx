import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import type { z } from 'zod'
import { useRegisterDonor } from '@/features/auth/hooks/useAuth'
import { registerDonorSchema } from '@/features/auth/schemas'
import { ageFromBirthDate, declarationsForAge } from '@/shared/lib/age'
import { businessDate } from '@/shared/lib/format'
import { maskCpf, maskPhone } from '@/shared/lib/masks'
import { usePageTitle } from '@/shared/lib/usePageTitle'
import { BLOOD_TYPES, SEX_LABEL, SEXES } from '@/shared/types'
import { AuthPageLayout } from '@/shared/ui/AuthPageLayout'
import { Button } from '@/shared/ui/Button'
import { ErrorAlert } from '@/shared/ui/ErrorAlert'
import { InputField, SelectField } from '@/shared/ui/Field'

type FormInput = z.input<typeof registerDonorSchema>
type FormOutput = z.output<typeof registerDonorSchema>

export function RegisterDonorPage() {
  usePageTitle('Cadastro de doador')
  const registerDonor = useRegisterDonor()
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(registerDonorSchema) })
  // As declarações exigidas dependem da idade: os campos aparecem conforme a data de nascimento.
  const required = declarationsForAge(ageFromBirthDate(watch('birthDate') ?? ''))

  return (
    <AuthPageLayout
      title="Cadastro de doador"
      subtitle="Seus dados são usados para avaliar sua elegibilidade a cada doação."
      size="lg"
    >
      <form
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={handleSubmit((values) => registerDonor.mutate(values))}
      >
        <InputField label="Nome completo" error={errors.name?.message} {...register('name')} />
        <InputField
          label="E-mail"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <InputField
          label="Telefone (opcional)"
          type="tel"
          autoComplete="tel"
          maxLength={15}
          mask={maskPhone}
          error={errors.phone?.message}
          {...register('phone')}
        />
        <InputField
          label="CPF"
          inputMode="numeric"
          maxLength={14}
          mask={maskCpf}
          error={errors.cpf?.message}
          {...register('cpf')}
        />
        <InputField
          label="Senha"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <InputField
          label="Confirmar senha"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <InputField
          label="Data de nascimento"
          type="date"
          max={businessDate()}
          error={errors.birthDate?.message}
          {...register('birthDate')}
        />
        <SelectField label="Sexo" error={errors.sex?.message} {...register('sex')}>
          <option value="">Selecione</option>
          {SEXES.map((sex) => (
            <option key={sex} value={sex}>
              {SEX_LABEL[sex]}
            </option>
          ))}
        </SelectField>
        <InputField
          label="Peso (kg)"
          type="number"
          step="0.1"
          error={errors.weightKg?.message}
          {...register('weightKg')}
        />

        <SelectField label="Tipo sanguíneo (opcional)" error={errors.bloodType?.message} {...register('bloodType')}>
          <option value="">Não sei</option>
          {BLOOD_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </SelectField>

        <InputField
          label="Data da sua última doação de sangue (opcional)"
          type="date"
          wrapperClassName="sm:col-span-2"
          error={errors.lastDonationDate?.message}
          {...register('lastDonationDate')}
        />

        {required.guardian && (
          <fieldset className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 sm:col-span-2">
            <legend className="px-1 text-sm font-medium text-slate-700">Menores de 18 anos</legend>
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
            {errors.guardianConsent?.message && (
              <p className="text-sm text-red-600">{errors.guardianConsent.message}</p>
            )}
          </fieldset>
        )}

        {required.donatedBefore60 && (
          <SelectField
            label="Você já doou sangue antes dos 60 anos?"
            wrapperClassName="sm:col-span-2"
            error={errors.donatedBefore60?.message}
            {...register('donatedBefore60')}
          >
            <option value="">Selecione</option>
            <option value="yes">Sim</option>
            <option value="no">Não</option>
          </SelectField>
        )}

        {required.regularDonor && (
          <SelectField
            label="Você é doador voluntário regular? (após os 70 anos, a doação depende de avaliação médica)"
            wrapperClassName="sm:col-span-2"
            error={errors.regularDonor?.message}
            {...register('regularDonor')}
          >
            <option value="">Selecione</option>
            <option value="yes">Sim</option>
            <option value="no">Não</option>
          </SelectField>
        )}

        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" className="mt-1" {...register('healthDataConsent')} />
            <span>
              Concordo com o uso dos meus dados de saúde (peso, tipo sanguíneo e histórico de doações) para avaliar
              minha elegibilidade à doação, conforme a LGPD. Posso exportar ou excluir meus dados a qualquer momento no
              meu perfil.{' '}
              <a href="/privacy" target="_blank" rel="noreferrer" className="font-medium text-red-700 underline">
                Saiba como usamos seus dados
              </a>
            </span>
          </label>
          {errors.healthDataConsent?.message && (
            <p className="text-sm text-red-600">{errors.healthDataConsent.message}</p>
          )}
        </div>

        <div className="sm:col-span-2">
          <ErrorAlert error={registerDonor.error} fallback="Não foi possível concluir o cadastro." />
        </div>

        <Button type="submit" loading={registerDonor.isPending} className="sm:col-span-2">
          Criar minha conta
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Já tem conta?{' '}
        <Link to="/login" className="font-medium text-red-600 hover:underline">
          Entrar
        </Link>
      </p>
    </AuthPageLayout>
  )
}
