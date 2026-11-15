import { zodResolver } from '@hookform/resolvers/zod'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import type { z } from 'zod'
import { useUpdateMe } from '@/features/auth'
import { DataRow } from '@/features/eligibility/components/DataRow'
import { DeclarationsCard } from '@/features/eligibility/components/DeclarationsCard'
import { DeleteAccountCard } from '@/features/eligibility/components/DeleteAccountCard'
import { EmailAlertsCard } from '@/features/eligibility/components/EmailAlertsCard'
import { useExportMyData, useMyProfile, useUpdateProfile } from '@/features/eligibility/hooks/useEligibility'
import { profileChanges } from '@/features/eligibility/profile-changes'
import { updateProfileSchema } from '@/features/eligibility/schemas'
import { formatBirthDateWithAge } from '@/shared/lib/age'
import { downloadJson } from '@/shared/lib/download'
import { businessDate, formatCpf, formatDate, toDateInputValue } from '@/shared/lib/format'
import { formatPhone, maskCpf, maskPhone } from '@/shared/lib/masks'
import { usePageTitle } from '@/shared/lib/usePageTitle'
import { useAuthStore } from '@/shared/session/auth.store'
import { BLOOD_TYPES, type DonorResponseDto, SEX_LABEL, SEXES } from '@/shared/types'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { ErrorAlert } from '@/shared/ui/ErrorAlert'
import { InputField, SelectField } from '@/shared/ui/Field'
import { PageTitle } from '@/shared/ui/PageTitle'
import { Spinner } from '@/shared/ui/Spinner'

type FormInput = z.input<typeof updateProfileSchema>
type FormOutput = z.output<typeof updateProfileSchema>

/** Valores do formulário a partir do perfil salvo (CPF e telefone já com máscara). */
function formValues(p: DonorResponseDto): FormInput {
  return {
    completeName: p.completeName,
    email: p.email,
    currentPassword: '',
    cpf: maskCpf(p.cpf),
    birthDate: p.birthDate.slice(0, 10),
    sex: p.sex,
    phone: p.phone ? maskPhone(p.phone) : '',
    weightKg: p.weightKg,
    bloodType: p.bloodType ?? '',
    lastDonationDate: p.lastDonationAt?.slice(0, 10) ?? '',
  }
}

/** Grupo de dados do cartão (Dados pessoais, Contato, Saúde). */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  )
}

export function ProfilePage() {
  usePageTitle('Meu perfil')
  const user = useAuthStore((s) => s.user)
  const profile = useMyProfile()
  const update = useUpdateProfile(user?.donorId)
  const updateMe = useUpdateMe()
  const exportData = useExportMyData(user?.donorId)
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const dataCardRef = useRef<HTMLDivElement>(null)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(updateProfileSchema) })

  // Fora da edição, o formulário acompanha o perfil salvo. Durante a edição, não: o que a pessoa
  // digitou não some se o perfil recarregar (ex.: uma parte do salvamento deu certo e a outra não).
  useEffect(() => {
    if (profile.data && !editing) reset(formValues(profile.data))
  }, [profile.data, editing, reset])

  const emailChanged =
    editing && !!profile.data && (watch('email') ?? '').trim().toLowerCase() !== profile.data.email.toLowerCase()

  function startEditing() {
    if (profile.data) reset(formValues(profile.data))
    update.reset()
    updateMe.reset()
    setSaved(false)
    setEditing(true)
  }

  function cancelEditing() {
    setEditing(false)
    if (profile.data) reset(formValues(profile.data))
  }

  const onSubmit = async (values: FormOutput) => {
    if (!profile.data) return
    update.reset()
    updateMe.reset()
    const changes = profileChanges(values, profile.data)
    if (changes.account?.email && !changes.account.currentPassword) {
      setError('currentPassword', { message: 'Informe sua senha atual para trocar o e-mail.' })
      return
    }
    try {
      // Perfil de doador primeiro: se a troca de e-mail falhar depois (ex.: senha errada), o resto já ficou salvo.
      if (changes.donor) await update.mutateAsync(changes.donor)
      if (changes.account) await updateMe.mutateAsync(changes.account)
      setEditing(false)
      setSaved(true)
      // O formulário é longo e o botão fica no fim: leva a pessoa até o aviso de sucesso, no topo do cartão.
      requestAnimationFrame(() => dataCardRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }))
    } catch {
      // Os erros aparecem nos alertas abaixo do formulário.
    }
  }

  if (profile.isLoading) {
    return <Spinner label="Carregando seu perfil..." />
  }
  if (!profile.data) {
    return <ErrorAlert error={profile.error ?? true} fallback="Não foi possível carregar seu perfil." />
  }

  const d = profile.data

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageTitle className="">Meu perfil</PageTitle>

      <div ref={dataCardRef} className="scroll-mt-4">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-slate-900">Meus dados</h2>
            {!editing && (
              <Button variant="secondary" onClick={startEditing}>
                Editar dados
              </Button>
            )}
          </div>

          {saved && !editing && (
            <div className="mb-4">
              <Alert variant="success" onClose={() => setSaved(false)}>
                Dados atualizados com sucesso.
                {user?.pendingEmail &&
                  ` Para concluir a troca do e-mail, abra o link que enviamos para ${user.pendingEmail}.`}
              </Alert>
            </div>
          )}

          {!editing ? (
            <div className="flex flex-col gap-6">
              <Section title="Dados pessoais">
                <div>
                  <DataRow label="Nome completo" value={d.completeName} />
                  <DataRow label="CPF" value={formatCpf(d.cpf)} />
                  <DataRow label="Data de nascimento" value={formatBirthDateWithAge(d.birthDate)} />
                  <DataRow label="Sexo" value={SEX_LABEL[d.sex]} />
                </div>
              </Section>
              <Section title="Contato">
                <div>
                  <DataRow label="E-mail" value={d.email} />
                  <DataRow label="Telefone" value={d.phone ? formatPhone(d.phone) : 'Não informado'} />
                </div>
              </Section>
              <Section title="Saúde">
                <div>
                  <DataRow label="Peso" value={`${d.weightKg} kg`} />
                  <DataRow label="Tipo sanguíneo" value={d.bloodType ?? 'Não informado'} />
                  <DataRow
                    label="Última doação"
                    value={d.lastDonationAt ? formatDate(d.lastDonationAt) : 'Nunca doou'}
                  />
                </div>
              </Section>
              <Section title="Definidos pelo sistema">
                <div>
                  <DataRow
                    label="Inaptidão permanente"
                    value={d.permanentUnfit ? 'Sim (registrada pelo hemocentro)' : 'Não'}
                  />
                  <DataRow
                    label="Consentimento (LGPD)"
                    value={d.healthDataConsentAt ? `Dado em ${formatDate(d.healthDataConsentAt)}` : 'Não registrado'}
                  />
                </div>
              </Section>
            </div>
          ) : (
            <form className="flex flex-col gap-6" onSubmit={handleSubmit(onSubmit)} noValidate>
              <Section title="Dados pessoais">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <InputField
                    label="Nome completo"
                    autoComplete="name"
                    wrapperClassName="sm:col-span-2"
                    error={errors.completeName?.message}
                    {...register('completeName')}
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
                    label="Data de nascimento"
                    type="date"
                    max={businessDate()}
                    error={errors.birthDate?.message}
                    {...register('birthDate')}
                  />
                  <SelectField label="Sexo" error={errors.sex?.message} {...register('sex')}>
                    {SEXES.map((sex) => (
                      <option key={sex} value={sex}>
                        {SEX_LABEL[sex]}
                      </option>
                    ))}
                  </SelectField>
                </div>
              </Section>

              <Section title="Contato">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  {emailChanged && (
                    <InputField
                      label="Senha atual (para trocar o e-mail)"
                      type="password"
                      autoComplete="current-password"
                      wrapperClassName="sm:col-span-2"
                      hint="Trocar o e-mail troca o seu login, por isso pedimos a senha. A troca só vale depois que você abrir o link que vamos enviar ao novo endereço."
                      error={errors.currentPassword?.message}
                      {...register('currentPassword')}
                    />
                  )}
                </div>
              </Section>

              <Section title="Saúde">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <InputField
                    label="Peso (kg)"
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    error={errors.weightKg?.message}
                    {...register('weightKg')}
                  />
                  <SelectField label="Tipo sanguíneo" error={errors.bloodType?.message} {...register('bloodType')}>
                    <option value="" disabled={!!d.bloodType}>
                      Não informado
                    </option>
                    {BLOOD_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </SelectField>
                  <InputField
                    label="Última doação"
                    type="date"
                    min={d.lastDonationAt?.slice(0, 10)}
                    max={businessDate()}
                    wrapperClassName="sm:col-span-2"
                    hint="Doou em outro lugar? Informe a data. Ela não pode ser anterior à já registrada; se estiver errada, procure o hemocentro."
                    error={errors.lastDonationDate?.message}
                    {...register('lastDonationDate')}
                  />
                </div>
              </Section>

              <ErrorAlert error={update.error} fallback="Não foi possível atualizar seus dados." />
              <ErrorAlert error={updateMe.error} fallback="Não foi possível atualizar seu nome ou e-mail." />

              <div className="flex flex-wrap gap-2">
                <Button type="submit" loading={isSubmitting}>
                  Salvar alterações
                </Button>
                <Button variant="ghost" disabled={isSubmitting} onClick={cancelEditing}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>

      <DeclarationsCard donor={d} />

      <Card className="flex flex-col gap-3">
        <h2 className="text-xl font-bold text-slate-900">Meus dados (LGPD)</h2>
        <p className="text-sm text-slate-600">
          Baixe uma cópia de tudo que o sistema guarda sobre você (cadastro, inaptidões, avaliações de elegibilidade e
          agendamentos).{' '}
          <Link to="/privacy" className="font-medium text-red-700 underline">
            Saiba como usamos seus dados
          </Link>
        </p>
        <ErrorAlert error={exportData.error} fallback="Não foi possível exportar seus dados." />
        <div>
          <Button
            variant="secondary"
            loading={exportData.isPending}
            onClick={() =>
              exportData.mutate(undefined, {
                onSuccess: (data) => downloadJson(data, `meus-dados-${toDateInputValue(new Date())}.json`),
              })
            }
          >
            Exportar meus dados
          </Button>
        </div>
      </Card>

      <EmailAlertsCard donor={d} />

      <DeleteAccountCard />
    </div>
  )
}
