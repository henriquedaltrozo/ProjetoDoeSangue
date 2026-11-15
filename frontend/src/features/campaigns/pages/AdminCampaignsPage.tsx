import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import type { z } from 'zod'
import { CampaignTypeBadge } from '@/features/campaigns/components/CampaignTypeBadge'
import { useCampaigns, useCreateCampaign, useDeactivateCampaign } from '@/features/campaigns/hooks/useCampaigns'
import { createCampaignSchema } from '@/features/campaigns/schemas'
import { useUnits } from '@/features/scheduling'
import { formatDate } from '@/shared/lib/format'
import { usePageTitle } from '@/shared/lib/usePageTitle'
import { BLOOD_TYPES, CAMPAIGN_TYPE_LABEL, CAMPAIGN_TYPES } from '@/shared/types'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { ConfirmButton } from '@/shared/ui/ConfirmButton'
import { ErrorAlert } from '@/shared/ui/ErrorAlert'
import { InputField, SelectField, TextareaField } from '@/shared/ui/Field'
import { PageTitle } from '@/shared/ui/PageTitle'
import { Spinner } from '@/shared/ui/Spinner'

type FormInput = z.input<typeof createCampaignSchema>
type FormOutput = z.output<typeof createCampaignSchema>

export function AdminCampaignsPage() {
  usePageTitle('Campanhas')
  const campaigns = useCampaigns()
  const units = useUnits()
  const create = useCreateCampaign()
  const deactivate = useDeactivateCampaign()
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(createCampaignSchema),
    // Todos os campos com valor inicial: o aviso de sucesso só aparece com o formulário limpo (!isDirty),
    // e um campo sem valor inicial fica "alterado" depois do reset (vazio ≠ undefined).
    defaultValues: {
      title: '',
      description: '',
      type: 'REGULAR',
      targetBloodType: '',
      collectionUnitId: '',
      startDate: '',
      endDate: '',
    },
  })

  const selectedType = useWatch({ control, name: 'type' })

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        <PageTitle className="mb-4">Nova campanha</PageTitle>
        <Card>
          <form
            className="flex flex-col gap-4"
            onSubmit={handleSubmit((values) => create.mutate(values, { onSuccess: () => reset() }))}
          >
            <InputField label="Título" error={errors.title?.message} {...register('title')} />
            <TextareaField label="Descrição" error={errors.description?.message} {...register('description')} />
            <SelectField label="Tipo" error={errors.type?.message} {...register('type')}>
              {CAMPAIGN_TYPES.map((type) => (
                <option key={type} value={type}>
                  {CAMPAIGN_TYPE_LABEL[type]}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Tipo sanguíneo (opcional)"
              error={errors.targetBloodType?.message}
              {...register('targetBloodType')}
            >
              <option value="">Todos os tipos</option>
              {BLOOD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Unidade de coleta (opcional)"
              error={errors.collectionUnitId?.message}
              {...register('collectionUnitId')}
            >
              <option value="">Todas as unidades</option>
              {units.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} - {u.city}/{u.uf}
                </option>
              ))}
            </SelectField>
            <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2">
              <InputField
                label="Data de início"
                type="date"
                error={errors.startDate?.message}
                {...register('startDate')}
              />
              <InputField label="Data de fim" type="date" error={errors.endDate?.message} {...register('endDate')} />
            </div>

            {selectedType === 'URGENT' && (
              <Alert variant="warning">
                Ao criar, os doadores aptos (do tipo sanguíneo escolhido, se houver) serão avisados automaticamente.
              </Alert>
            )}

            <ErrorAlert error={create.error} fallback="Não foi possível criar a campanha." />
            {/* O aviso some quando o próximo cadastro começa a ser preenchido. */}
            {create.isSuccess && !isDirty && (
              <Alert variant="success" onClose={() => create.reset()}>
                Campanha cadastrada com sucesso.
              </Alert>
            )}

            <Button type="submit" loading={create.isPending}>
              Cadastrar campanha
            </Button>
          </form>
        </Card>
      </div>

      <div>
        <h2 className="mb-4 text-2xl font-bold text-slate-900">Campanhas ativas</h2>
        {campaigns.isLoading && <Spinner label="Carregando campanhas..." />}
        <ErrorAlert error={campaigns.error} fallback="Não foi possível carregar as campanhas." className="mb-4" />
        <ErrorAlert error={deactivate.error} fallback="Não foi possível desativar a campanha." className="mb-4" />
        {campaigns.data?.length === 0 && (
          <Card>
            <p className="text-slate-500">Nenhuma campanha ativa.</p>
          </Card>
        )}
        <div className="flex flex-col gap-3">
          {campaigns.data?.map((c) => (
            <Card key={c.id}>
              <div className="mb-1 flex items-start justify-between gap-3">
                <p className="font-medium text-slate-900">{c.title}</p>
                <CampaignTypeBadge type={c.type} />
              </div>
              <p className="mb-2 text-sm text-slate-600">{c.description}</p>
              <p className="mb-3 text-xs text-slate-400">
                {formatDate(c.startDate)} até {formatDate(c.endDate)}
                {c.targetBloodType && ` - Tipo sanguíneo: ${c.targetBloodType}`}
              </p>
              {/* Não existe reativação de campanha no backend: por isso a ação pede confirmação. */}
              <ConfirmButton
                question="Desativar esta campanha? Ela sai da lista dos doadores e não pode ser reativada."
                confirmLabel="Confirmar desativação"
                loading={deactivate.isPending && deactivate.variables === c.id}
                onConfirm={() => deactivate.mutate(c.id)}
              >
                Desativar
              </ConfirmButton>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
