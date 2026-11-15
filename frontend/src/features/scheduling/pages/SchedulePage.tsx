import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCampaigns } from '@/features/campaigns'
import { EligibilityStatusCard, useEligibilityCheck } from '@/features/eligibility'
import {
  useAvailability,
  useCreateAppointment,
  useMyAppointments,
  useUnits,
} from '@/features/scheduling/hooks/useScheduling'
import { isOpenForDonor, MAX_DAYS_AHEAD } from '@/features/scheduling/lib/attendance'
import { slotTimes, upcomingSlots } from '@/features/scheduling/lib/slots'
import {
  addDaysISO,
  businessDate,
  businessDateTimeToISO,
  businessTime,
  formatDate,
  formatDateTime,
} from '@/shared/lib/format'
import { usePageTitle } from '@/shared/lib/usePageTitle'
import { useAuthStore } from '@/shared/session/auth.store'
import type { AppointmentCreatedDto } from '@/shared/types'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { ButtonLink } from '@/shared/ui/ButtonLink'
import { Card } from '@/shared/ui/Card'
import { ErrorAlert } from '@/shared/ui/ErrorAlert'
import { InputField, SelectField } from '@/shared/ui/Field'
import { PageTitle } from '@/shared/ui/PageTitle'
import { Spinner } from '@/shared/ui/Spinner'

/** Estado de navegação enviado para "Meus agendamentos", que mostra o resultado da avaliação. */
export interface ScheduleResultState {
  createdAppointment: AppointmentCreatedDto
}

/** Amanhã, em Brasília. */
function tomorrow(): string {
  return addDaysISO(businessDate(), 1)
}

export function SchedulePage() {
  usePageTitle('Agendar doação')
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const units = useUnits()
  const campaigns = useCampaigns()
  const create = useCreateAppointment()
  // O backend só aceita um agendamento em aberto por doador: avisa antes de preencher tudo.
  const myAppointments = useMyAppointments()
  const openAppointment = myAppointments.data?.find((a) => isOpenForDonor(a, Date.now()))
  const [searchParams] = useSearchParams()
  // Situação para doar: sem poder doar hoje, as datas antes da liberada ficam bloqueadas; sem data
  // prevista (ex.: peso abaixo do mínimo), não há o que agendar.
  const eligibility = useEligibilityCheck(user?.donorId)
  const notEligible = eligibility.data !== undefined && eligibility.data.result !== 'ELIGIBLE'
  const eligibleFrom = notEligible ? eligibility.data?.nextEligibilityDate : null
  const cannotSchedule = notEligible && !eligibleFrom

  const [collectionUnitId, setCollectionUnitId] = useState('')
  const [date, setDate] = useState(tomorrow)
  const [time, setTime] = useState('09:00')
  const [campaignId, setCampaignId] = useState(searchParams.get('campaignId') ?? '')

  const activeUnits = units.data?.filter((u) => u.active) ?? []
  // Uma campanha que não está mais na lista (encerrada ou desativada) não é enviada.
  const selectedCampaign = campaigns.data?.find((c) => c.id === campaignId)
  const campaignUnavailable = Boolean(campaignId) && campaigns.isSuccess && !selectedCampaign

  // O agendamento de uma campanha precisa cair no período dela e, se ela é de uma unidade, nessa
  // unidade (o backend recusa o contrário): a tela já limita a data e fixa a unidade.
  const today = businessDate()
  const minDate = [today, selectedCampaign?.startDate, eligibleFrom ?? undefined]
    .filter((d): d is string => Boolean(d))
    .reduce((latest, d) => (d > latest ? d : latest))
  // Até 90 dias à frente (o backend recusa depois disso), ou até o fim da campanha, o que vier antes.
  const horizonDate = addDaysISO(today, MAX_DAYS_AHEAD)
  const campaignEnd = selectedCampaign?.endDate
  const maxDate = campaignEnd && campaignEnd < horizonDate ? campaignEnd : horizonDate
  // O doador só volta a poder doar depois do limite de 90 dias: ainda não dá para agendar.
  const tooFarAhead = minDate > horizonDate
  // A campanha acaba antes da data em que o doador volta a poder doar.
  const campaignEndsTooSoon = Boolean(campaignEnd) && !tooFarAhead && minDate > maxDate
  const effectiveDate = date < minDate ? minDate : maxDate && date > maxDate ? maxDate : date
  const lockedUnitId = selectedCampaign?.collectionUnitId ?? null
  const effectiveUnitId = lockedUnitId ?? collectionUnitId
  const lockedUnitInactive = lockedUnitId !== null && units.isSuccess && !activeUnits.some((u) => u.id === lockedUnitId)

  const availability = useAvailability(effectiveUnitId || undefined, effectiveDate || undefined)

  // Só os horários da grade (de 30 em 30 min) em que a unidade atende neste dia e que ainda não passaram.
  const selectedUnit = activeUnits.find((u) => u.id === effectiveUnitId)
  const slots = effectiveDate
    ? upcomingSlots(slotTimes(selectedUnit?.operatingHours, effectiveDate), effectiveDate, today, businessTime())
    : []
  const chosenTime = slots.includes(time) ? time : (slots[0] ?? '')

  // O horário escolhido já está lotado nesta unidade (todas as vagas simultâneas ocupadas)?
  const chosenInstant =
    effectiveDate && chosenTime ? new Date(businessDateTimeToISO(effectiveDate, chosenTime)).getTime() : null
  const chosenSlotFull = Boolean(
    effectiveUnitId &&
      chosenInstant !== null &&
      availability.data?.times.some((t) => new Date(t.dateTime).getTime() === chosenInstant && t.availableSlots <= 0),
  )

  const blocked =
    !effectiveUnitId ||
    !chosenTime ||
    lockedUnitInactive ||
    Boolean(openAppointment) ||
    cannotSchedule ||
    campaignEndsTooSoon ||
    tooFarAhead ||
    chosenSlotFull

  function handleSubmit() {
    if (!user?.donorId || blocked) {
      return
    }
    const dateTime = businessDateTimeToISO(effectiveDate, chosenTime)
    create.mutate(
      {
        donorId: user.donorId,
        collectionUnitId: effectiveUnitId,
        dateTime,
        campaignId: selectedCampaign?.id,
      },
      {
        onSuccess: (createdAppointment) =>
          navigate('/appointments', { state: { createdAppointment } satisfies ScheduleResultState }),
      },
    )
  }

  return (
    <div>
      <PageTitle>Agendar doação</PageTitle>

      {/* Com um agendamento em aberto, não dá para marcar outro (um por vez): a tela mostra só isso. */}
      {openAppointment ? (
        <Alert variant="warning" title="Você já tem um agendamento em aberto">
          <p>
            Sua doação está marcada para {formatDateTime(openAppointment.dateTime)}. Para agendar outra data, cancele
            esse agendamento antes.
          </p>
          <ButtonLink to="/appointments" variant="secondary" className="mt-2">
            Ver meus agendamentos
          </ButtonLink>
        </Alert>
      ) : (
        <>
          {user?.donorId && (
            <div className="mb-4">
              <EligibilityStatusCard donorId={user.donorId} />
            </div>
          )}

          <Card className="flex flex-col gap-4">
            {selectedCampaign && (
              <Alert variant="warning">
                Este agendamento será vinculado à campanha <strong>{selectedCampaign.title}</strong>, válida de{' '}
                {formatDate(selectedCampaign.startDate)} até {formatDate(selectedCampaign.endDate)}.
              </Alert>
            )}
            {campaignUnavailable && (
              <Alert variant="warning">
                A campanha escolhida não está mais disponível. Você ainda pode agendar uma doação sem campanha.
              </Alert>
            )}
            {tooFarAhead && (
              <Alert variant="warning">
                Os agendamentos abrem com até {MAX_DAYS_AHEAD} dias de antecedência. Você poderá agendar a partir de{' '}
                {formatDate(addDaysISO(minDate, -MAX_DAYS_AHEAD))}.
              </Alert>
            )}
            {campaignEndsTooSoon && (
              <Alert variant="warning">
                Esta campanha termina antes da data em que você poderá doar. Escolha outra campanha ou agende sem
                campanha.
              </Alert>
            )}
            {lockedUnitInactive && (
              <Alert variant="warning">A unidade desta campanha não está recebendo agendamentos no momento.</Alert>
            )}

            {campaigns.data && campaigns.data.length > 0 && (
              <SelectField
                label="Campanha (opcional)"
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
              >
                <option value="">Nenhuma</option>
                {campaigns.data.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </SelectField>
            )}

            <ErrorAlert error={units.error} fallback="Não foi possível carregar as unidades de coleta." />
            {units.isLoading ? (
              <Spinner label="Carregando unidades de coleta..." />
            ) : (
              <SelectField
                label="Unidade de coleta"
                value={effectiveUnitId}
                disabled={lockedUnitId !== null}
                onChange={(e) => setCollectionUnitId(e.target.value)}
              >
                <option value="">Selecione uma unidade</option>
                {activeUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} - {u.city}/{u.uf}
                  </option>
                ))}
              </SelectField>
            )}

            <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2">
              <InputField
                label="Data"
                type="date"
                min={minDate}
                max={maxDate}
                value={effectiveDate}
                onChange={(e) => setDate(e.target.value)}
              />
              <SelectField
                label="Horário"
                value={chosenTime}
                disabled={slots.length === 0}
                onChange={(e) => setTime(e.target.value)}
              >
                {slots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </SelectField>
            </div>
            {effectiveUnitId && effectiveDate && slots.length === 0 && (
              <Alert variant="warning">
                Não há horários disponíveis nesta unidade neste dia (fora do funcionamento ou já passados). Escolha
                outra data.
              </Alert>
            )}

            <ErrorAlert error={availability.error} fallback="Não foi possível consultar a disponibilidade." />
            {chosenSlotFull && (
              <Alert variant="warning">
                Não há mais vagas às {chosenTime} de {formatDate(effectiveDate)} nesta unidade. Escolha outro horário ou
                outra data.
              </Alert>
            )}

            <ErrorAlert error={create.error} fallback="Não foi possível agendar." />

            <Button onClick={handleSubmit} loading={create.isPending} disabled={blocked}>
              Confirmar agendamento
            </Button>
          </Card>
        </>
      )}
    </div>
  )
}
