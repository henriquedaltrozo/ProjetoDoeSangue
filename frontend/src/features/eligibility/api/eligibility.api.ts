import { http } from '@/shared/api/http'
import type {
  AccessAuditDto,
  BloodType,
  DonorDataExportDto,
  DonorResponseDto,
  DonorSearchResponseDto,
  EligibilityCheckResponseDto,
  Sex,
  TemporaryUnfitnessDto,
} from '@/shared/types'

export async function myProfile(): Promise<DonorResponseDto> {
  const { data } = await http.get<DonorResponseDto>('/donors/me')
  return data
}

export async function findDonor(donorId: string): Promise<DonorResponseDto> {
  const { data } = await http.get<DonorResponseDto>(`/donors/${donorId}`)
  return data
}

/** [admin] Busca/lista doadores por nome ou CPF (parcial). */
/** [admin] Busca paginada por nome ou CPF, ordenada por nome. */
export async function searchDonors(search: string, page: number): Promise<DonorSearchResponseDto> {
  const { data } = await http.get<DonorSearchResponseDto>('/donors/search', { params: { search, page } })
  return data
}

/** Quantos ids o backend aceita por pedido (MAX_DONOR_IDS no eligibility-service). */
export const MAX_DONOR_IDS_PER_REQUEST = 100

/** [admin] Doadores pelos ids (ex.: os nomes de uma lista de agendamentos), em lotes de 100. */
export async function listDonorsByIds(ids: string[]): Promise<DonorResponseDto[]> {
  const batches: string[][] = []
  for (let i = 0; i < ids.length; i += MAX_DONOR_IDS_PER_REQUEST) {
    batches.push(ids.slice(i, i + MAX_DONOR_IDS_PER_REQUEST))
  }
  const results = await Promise.all(
    batches.map((batch) => http.get<DonorResponseDto[]>('/donors', { params: { ids: batch.join(',') } })),
  )
  return results.flatMap(({ data }) => data)
}

export interface UpdateProfilePayload {
  cpf?: string
  birthDate?: string
  sex?: Sex
  /** null apaga o telefone. */
  phone?: string | null
  weightKg?: number
  bloodType?: BloodType
  /** Só avança: não pode ser anterior à última doação já registrada. */
  lastDonationDate?: string
  /** Declarações (só as que valem para a idade do doador). */
  guardianName?: string
  guardianConsent?: boolean
  donatedBefore60?: boolean
  regularDonor?: boolean
  /** Aceita receber avisos de campanhas e de quando pode doar de novo. */
  receiveAlerts?: boolean
}

/** Link "não quero mais receber" dos e-mails: desliga os avisos do doador do token (sem login). */
export async function unsubscribeAlerts(token: string): Promise<void> {
  await http.post('/donors/alerts/unsubscribe', { token })
}

/** Atualiza os dados do perfil do doador (o próprio doador ou um admin). Nome e e-mail: PATCH /auth/me. */
export async function updateDonor(donorId: string, payload: UpdateProfilePayload): Promise<DonorResponseDto> {
  const { data } = await http.patch<DonorResponseDto>(`/donors/${donorId}`, payload)
  return data
}

/** O doador (ou um admin) consulta a elegibilidade agora. A consulta não é gravada. */
export async function assessNow(donorId: string): Promise<EligibilityCheckResponseDto> {
  const { data } = await http.post<EligibilityCheckResponseDto>('/eligibility/assess', {
    donorId,
    origin: 'DONOR_QUERY',
  })
  return data
}

export async function listUnfitness(donorId: string): Promise<TemporaryUnfitnessDto[]> {
  const { data } = await http.get<TemporaryUnfitnessDto[]>(`/donors/${donorId}/unfitness`)
  return data
}

export interface RegisterUnfitnessPayload {
  reason: string
  category: TemporaryUnfitnessDto['category']
  startDate: string
  expectedEndDate?: string
}

export async function registerUnfitness(
  donorId: string,
  payload: RegisterUnfitnessPayload,
): Promise<TemporaryUnfitnessDto> {
  const { data } = await http.post<TemporaryUnfitnessDto>(`/donors/${donorId}/unfitness`, payload)
  return data
}

/** [admin] Exclui uma inaptidão temporária registrada por engano. */
export async function deleteUnfitness(donorId: string, unfitnessId: string): Promise<void> {
  await http.delete(`/donors/${donorId}/unfitness/${unfitnessId}`)
}

/** [admin] Encerra antecipadamente um período de inaptidão temporária em aberto. */
export async function endUnfitness(donorId: string, unfitnessId: string): Promise<TemporaryUnfitnessDto> {
  const { data } = await http.patch<TemporaryUnfitnessDto>(`/donors/${donorId}/unfitness/${unfitnessId}/end`, {})
  return data
}

/** [admin] Registra a avaliação médica favorável de um doador regular com 70 anos ou mais. */
export async function registerMedicalClearance(donorId: string): Promise<DonorResponseDto> {
  const { data } = await http.post<DonorResponseDto>(`/donors/${donorId}/medical-clearance`)
  return data
}

/** [admin] Registra a inaptidão permanente do doador, com o motivo. */
export async function registerPermanentUnfitness(donorId: string, reason: string): Promise<DonorResponseDto> {
  const { data } = await http.post<DonorResponseDto>(`/donors/${donorId}/permanent-unfitness`, { reason })
  return data
}

/** [admin] Desfaz a inaptidão permanente (registro feito por engano). */
export async function revokePermanentUnfitness(donorId: string): Promise<DonorResponseDto> {
  const { data } = await http.delete<DonorResponseDto>(`/donors/${donorId}/permanent-unfitness`)
  return data
}

/** [admin] Desfaz a avaliação médica. */
export async function revokeMedicalClearance(donorId: string): Promise<DonorResponseDto> {
  const { data } = await http.delete<DonorResponseDto>(`/donors/${donorId}/medical-clearance`)
  return data
}

/** [LGPD] Exporta (portabilidade) o cadastro, inaptidões e avaliações do doador. */
export async function exportData(donorId: string): Promise<DonorDataExportDto> {
  const { data } = await http.get<DonorDataExportDto>(`/donors/${donorId}/export`)
  return data
}

/** [admin] Histórico de quem acessou/alterou o perfil deste doador. */
export async function listAudit(donorId: string): Promise<AccessAuditDto[]> {
  const { data } = await http.get<AccessAuditDto[]>(`/donors/${donorId}/audit`)
  return data
}
