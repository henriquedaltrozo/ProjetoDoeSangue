import { http } from '@/shared/api/http'
import type {
  AppointmentCreatedDto,
  AppointmentDto,
  AppointmentStatus,
  AttendanceConfirmationDto,
  AvailabilityQueryDto,
  CollectionUnitDto,
} from '@/shared/types'

export async function listUnits(): Promise<CollectionUnitDto[]> {
  const { data } = await http.get<CollectionUnitDto[]>('/collection-units')
  return data
}

export async function checkAvailability(collectionUnitId: string, date: string): Promise<AvailabilityQueryDto> {
  const { data: result } = await http.get<AvailabilityQueryDto>('/appointments/availability', {
    params: { collectionUnitId, date },
  })
  return result
}

export interface CreateAppointmentPayload {
  donorId: string
  collectionUnitId: string
  dateTime: string
  campaignId?: string
}

export async function createAppointment(payload: CreateAppointmentPayload): Promise<AppointmentCreatedDto> {
  const { data } = await http.post<AppointmentCreatedDto>('/appointments', payload)
  return data
}

export async function myAppointments(): Promise<AppointmentDto[]> {
  const { data } = await http.get<AppointmentDto[]>('/appointments/me')
  return data
}

export async function cancelAppointment(id: string, cancellationReason?: string): Promise<AppointmentDto> {
  const { data } = await http.post<AppointmentDto>(`/appointments/${id}/cancel`, { cancellationReason })
  return data
}

/** O doador (ou um admin em nome dele) confirma a presença: ELIGIBILITY_CONFIRMED -> CONFIRMED. */
export async function confirmAttendance(id: string): Promise<AppointmentDto> {
  const { data } = await http.post<AppointmentDto>(`/appointments/${id}/confirm-attendance`)
  return data
}

/** Confirmação pelo link do e-mail: o token assinado dispensa o login. */
export async function confirmAttendanceByToken(token: string): Promise<AttendanceConfirmationDto> {
  const { data } = await http.post<AttendanceConfirmationDto>('/appointments/confirm-attendance', { token })
  return data
}

// --- Operações administrativas do scheduling-service ---

export interface ListAppointmentsFilter {
  status?: AppointmentStatus
  collectionUnitId?: string
  date?: string
}

export async function listAppointments(filter: ListAppointmentsFilter): Promise<AppointmentDto[]> {
  const { data } = await http.get<AppointmentDto[]>('/appointments', { params: filter })
  return data
}

export async function checkin(id: string): Promise<AppointmentDto> {
  const { data } = await http.post<AppointmentDto>(`/appointments/${id}/checkin`)
  return data
}

export async function complete(id: string): Promise<AppointmentDto> {
  const { data } = await http.post<AppointmentDto>(`/appointments/${id}/complete`)
  return data
}

/** [admin] Marca um agendamento (elegibilidade confirmada, horário já passado) como não comparecido. */
export async function markNoShow(id: string): Promise<AppointmentDto> {
  const { data } = await http.post<AppointmentDto>(`/appointments/${id}/no-show`)
  return data
}

export interface CreateUnitPayload {
  name: string
  address: string
  neighborhood: string
  city: string
  uf: string
  phone: string
  simultaneousCapacity: number
  /** Por dia da semana (dom, seg, ...), faixas "HH:MM-HH:MM"; ausente = qualquer horário da grade. */
  operatingHours?: Record<string, string[]>
}

export async function createUnit(payload: CreateUnitPayload): Promise<CollectionUnitDto> {
  const { data } = await http.post<CollectionUnitDto>('/collection-units', payload)
  return data
}

export async function deactivateUnit(id: string): Promise<CollectionUnitDto> {
  const { data } = await http.delete<CollectionUnitDto>(`/collection-units/${id}`)
  return data
}

/** [admin] Lista todas as unidades, incluindo desativadas (para reativação). */
export async function listAllUnits(): Promise<CollectionUnitDto[]> {
  const { data } = await http.get<CollectionUnitDto[]>('/collection-units/admin/all')
  return data
}

export async function reactivateUnit(id: string): Promise<CollectionUnitDto> {
  const { data } = await http.post<CollectionUnitDto>(`/collection-units/${id}/reactivate`)
  return data
}
