import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import type { z } from 'zod'
import {
  useAllUnits,
  useCreateUnit,
  useDeactivateUnit,
  useReactivateUnit,
} from '@/features/scheduling/hooks/useScheduling'
import { createUnitSchema, EMPTY_WEEK_HOURS, WEEKDAYS } from '@/features/scheduling/schemas'
import { formatPhone, maskPhone, maskUf } from '@/shared/lib/masks'
import { usePageTitle } from '@/shared/lib/usePageTitle'
import type { CollectionUnitDto } from '@/shared/types'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { ConfirmPrompt } from '@/shared/ui/ConfirmPrompt'
import { ErrorAlert } from '@/shared/ui/ErrorAlert'
import { InputField } from '@/shared/ui/Field'
import { PageTitle } from '@/shared/ui/PageTitle'
import { Spinner } from '@/shared/ui/Spinner'

type FormInput = z.input<typeof createUnitSchema>
type FormOutput = z.output<typeof createUnitSchema>

/** "seg 08:00-17:00 · sab 08:00-12:00", na ordem da semana; sem horário, "qualquer horário da grade". */
function describeHours(hours: CollectionUnitDto['operatingHours']): string {
  if (!hours || Object.keys(hours).length === 0) return 'qualquer horário da grade'
  return WEEKDAYS.filter((day) => hours[day.key]?.length)
    .map((day) => `${day.key} ${hours[day.key].join(', ')}`)
    .join(' · ')
}

export function AdminUnitsPage() {
  usePageTitle('Unidades de coleta')
  const [showInactive, setShowInactive] = useState(false)
  // Unidade cuja desativação está sendo confirmada (a pergunta aparece embaixo do cartão dela).
  const [askingId, setAskingId] = useState<string | null>(null)
  const units = useAllUnits()
  const create = useCreateUnit()
  const deactivate = useDeactivateUnit()
  const reactivate = useReactivateUnit()
  const displayedUnits = showInactive ? units.data : units.data?.filter((u) => u.active)
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(createUnitSchema),
    // Todos os campos com valor inicial: o aviso de sucesso só aparece com o formulário limpo (!isDirty),
    // e um campo sem valor inicial fica "alterado" depois do reset (vazio ≠ undefined).
    defaultValues: {
      name: '',
      address: '',
      neighborhood: '',
      city: '',
      uf: '',
      phone: '',
      simultaneousCapacity: '',
      hours: EMPTY_WEEK_HOURS,
    },
  })

  // Quais dias estão marcados: os horários dos outros ficam travados.
  const hours = useWatch({ control, name: 'hours' })

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        <PageTitle className="mb-4">Nova unidade de coleta</PageTitle>
        <Card>
          <form
            className="flex flex-col gap-4"
            onSubmit={handleSubmit((values) => create.mutate(values, { onSuccess: () => reset() }))}
          >
            <InputField label="Nome" error={errors.name?.message} {...register('name')} />
            <InputField label="Endereço" error={errors.address?.message} {...register('address')} />
            <InputField label="Bairro" error={errors.neighborhood?.message} {...register('neighborhood')} />
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Cidade" error={errors.city?.message} {...register('city')} />
              <InputField label="UF" maxLength={2} mask={maskUf} error={errors.uf?.message} {...register('uf')} />
            </div>
            <InputField
              label="Telefone"
              type="tel"
              maxLength={15}
              mask={maskPhone}
              error={errors.phone?.message}
              {...register('phone')}
            />
            <InputField
              label="Capacidade simultânea (por horário)"
              type="number"
              error={errors.simultaneousCapacity?.message}
              {...register('simultaneousCapacity')}
            />

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium text-slate-700">Horário de funcionamento</legend>
              <p className="text-xs text-slate-500">
                Marque os dias em que a unidade atende. Sem nenhum dia marcado, ela aceita qualquer horário da grade (de
                30 em 30 minutos).
              </p>
              {WEEKDAYS.map((day, i) => (
                <div key={day.key} className="grid grid-cols-[6rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" {...register(`hours.${i}.open`)} />
                    {day.label}
                  </label>
                  {/* readOnly (e não disabled): o valor continua no formulário, só não vale enquanto o dia não está marcado. */}
                  <input
                    type="time"
                    step={1800}
                    aria-label={`Início - ${day.label}`}
                    readOnly={!hours?.[i]?.open}
                    className="w-full min-w-0 rounded-lg border border-slate-300 px-2 py-1 text-sm read-only:bg-slate-100 read-only:text-slate-400"
                    {...register(`hours.${i}.start`)}
                  />
                  <input
                    type="time"
                    step={1800}
                    aria-label={`Fim - ${day.label}`}
                    readOnly={!hours?.[i]?.open}
                    className="w-full min-w-0 rounded-lg border border-slate-300 px-2 py-1 text-sm read-only:bg-slate-100 read-only:text-slate-400"
                    {...register(`hours.${i}.end`)}
                  />
                  {errors.hours?.[i]?.end?.message && (
                    <p className="col-span-3 text-sm text-red-600">{errors.hours[i]?.end?.message}</p>
                  )}
                </div>
              ))}
            </fieldset>

            <ErrorAlert error={create.error} fallback="Não foi possível criar a unidade." />
            {/* O aviso some quando o próximo cadastro começa a ser preenchido. */}
            {create.isSuccess && !isDirty && (
              <Alert variant="success" onClose={() => create.reset()}>
                Unidade cadastrada com sucesso.
              </Alert>
            )}

            <Button type="submit" loading={create.isPending}>
              Cadastrar unidade
            </Button>
          </form>
        </Card>
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">Unidades</h2>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Mostrar desativadas
          </label>
        </div>
        {units.isLoading && <Spinner label="Carregando unidades..." />}
        <ErrorAlert error={units.error} fallback="Não foi possível carregar as unidades." className="mb-4" />
        <ErrorAlert
          error={deactivate.error ?? reactivate.error}
          fallback="Não foi possível alterar a unidade."
          className="mb-4"
        />
        <div className="flex flex-col gap-3">
          {displayedUnits?.map((u) => (
            <Card key={u.id} className={`flex flex-col gap-3 ${!u.active ? 'opacity-60' : ''}`}>
              {/* O texto ocupa o espaço que sobra e quebra linha; o botão fica sempre à direita. */}
              {/* No celular o botão vai para baixo do texto; a partir do tablet, fica à direita. */}
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">
                    {u.name} {!u.active && <span className="text-xs font-normal text-slate-400">(desativada)</span>}
                  </p>
                  <p className="text-sm text-slate-500">
                    {u.address}
                    {u.neighborhood && `, ${u.neighborhood}`} - {u.city}/{u.uf}
                  </p>
                  <p className="text-xs text-slate-400">Telefone: {formatPhone(u.phone)}</p>
                  <p className="text-xs text-slate-400">Capacidade: {u.simultaneousCapacity} por horário</p>
                  <p className="text-xs text-slate-400">Funcionamento: {describeHours(u.operatingHours)}</p>
                </div>
                <div className="shrink-0">
                  {u.active ? (
                    <Button
                      variant="danger"
                      aria-expanded={askingId === u.id}
                      loading={deactivate.isPending && deactivate.variables === u.id}
                      onClick={() => setAskingId(askingId === u.id ? null : u.id)}
                    >
                      Desativar
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      loading={reactivate.isPending && reactivate.variables === u.id}
                      onClick={() => {
                        deactivate.reset()
                        reactivate.mutate(u.id)
                      }}
                    >
                      Reativar
                    </Button>
                  )}
                </div>
              </div>
              {askingId === u.id && (
                <ConfirmPrompt
                  question="Desativar esta unidade? Os agendamentos dela ainda por vir serão cancelados e os doadores verão o motivo."
                  confirmLabel="Confirmar desativação"
                  onConfirm={() => {
                    setAskingId(null)
                    reactivate.reset()
                    deactivate.mutate(u.id)
                  }}
                  onCancel={() => setAskingId(null)}
                />
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
