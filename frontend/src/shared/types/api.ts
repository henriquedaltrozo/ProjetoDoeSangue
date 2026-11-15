// Tipos espelhando os DTOs/enums do backend (ver backend/application/*/dto e presentation/*/http/presenters).
// Usamos union types de string em vez de `enum` do TypeScript porque o
// template do Vite habilita `erasableSyntaxOnly`, que não permite enums
// tradicionais (só teriam efeito em tempo de compilação "apagável").

export type Role = 'donor' | 'admin'

// Enums usados em formulários/filtros viram listas `as const`: o tipo sai da lista, e os schemas
// zod (z.enum) e os <select> reutilizam a mesma lista em vez de repeti-la.

export const SEXES = ['M', 'F'] as const
export type Sex = (typeof SEXES)[number]

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const
export type BloodType = (typeof BLOOD_TYPES)[number]

export const APPOINTMENT_STATUSES = [
  'SCHEDULED',
  'ELIGIBILITY_CONFIRMED',
  'ELIGIBILITY_DENIED',
  'CONFIRMED',
  'CHECKIN_PERFORMED',
  'COMPLETED',
  'CANCELED',
  'NO_SHOW',
] as const
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]

export type EligibilityResult = 'ELIGIBLE' | 'TEMPORARY_UNFIT' | 'PERMANENT_UNFIT'

export type IneligibilityReason =
  | 'MIN_INTERVAL_NOT_FULFILLED'
  | 'AGE_BELOW_MIN'
  | 'AGE_ABOVE_MAX'
  | 'AGE_ABOVE_MAX_FIRST_DONATION'
  | 'GUARDIAN_CONSENT_REQUIRED'
  | 'MEDICAL_CLEARANCE_REQUIRED'
  | 'MAX_ANNUAL_DONATIONS_REACHED'
  | 'INSUFFICIENT_WEIGHT'
  | 'ACTIVE_TEMPORARY_UNFITNESS'
  | 'PERMANENT_UNFIT'

export type AssessmentSource = 'DONOR_QUERY' | 'APPOINTMENT_VALIDATION' | 'POST_DONATION'

/** Avisos que acompanham uma avaliação apta. */
export type AssessmentNotice = 'BRING_GUARDIAN_CONSENT'

export const UNFITNESS_CATEGORIES = ['CLINIC', 'BEHAVIORAL', 'LABORATORY', 'OTHER'] as const
export type UnfitnessCategory = (typeof UNFITNESS_CATEGORIES)[number]

export interface UserResponseDto {
  id: string
  email: string
  name: string
  role: Role
  donorId: string | null
  active: boolean
  /** O e-mail da conta já foi confirmado pelo link enviado a ele (sem isso, o doador não agenda). */
  emailVerified: boolean
  /** E-mail novo pedido em Meu perfil, à espera da confirmação pelo link (até lá, vale o atual). */
  pendingEmail: string | null
}

export interface AuthResponseDto {
  accessToken: string
  user: UserResponseDto
}

export interface DonorResponseDto {
  id: string
  userId: string
  completeName: string
  cpf: string
  birthDate: string
  sex: Sex
  /** Opcional: informado pelo doador no perfil, se quiser. */
  phone: string | null
  email: string
  weightKg: number
  bloodType: BloodType | null
  lastDonationAt: string | null
  /** Doações dos últimos 12 meses (base do limite anual). */
  donationDates: string[]
  permanentUnfit: boolean
  /** Motivo registrado pelo hemocentro (null quando não é inapto permanente). */
  permanentUnfitnessReason: string | null
  active: boolean
  createdAt: string
  updatedAt: string
  /** Declarações do doador (o sistema não tem o histórico de doações de fora dele). */
  guardianName: string | null
  guardianConsentDeclared: boolean
  donatedBefore60: boolean | null
  regularDonorDeclared: boolean
  /** Avaliação médica favorável registrada por um admin (70 anos ou mais). */
  medicalClearanceAt: string | null
  /** Último dia em que a avaliação médica vale (12 meses); null sem avaliação. */
  medicalClearanceValidUntil: string | null
  /** [LGPD] Quando o doador consentiu com o uso dos dados de saúde; null em cadastros antigos. */
  healthDataConsentAt: string | null
  /** Aceita receber por e-mail avisos de campanhas e de quando pode doar de novo. */
  receiveAlerts: boolean
}

/** Uma página da busca de doadores do painel admin (GET /donors/search). */
export interface DonorSearchResponseDto {
  items: DonorResponseDto[]
  /** Total encontrado pela busca, em todas as páginas. */
  total: number
  page: number
  pageSize: number
}

export interface EligibilityAssessmentResponseDto {
  id: string
  donorId: string
  appointmentId: string | null
  result: EligibilityResult
  reasons: IneligibilityReason[]
  notices: AssessmentNotice[]
  nextEligibilityDate: string | null
  origin: AssessmentSource
  assessedAt: string
}

/** Resposta da consulta "Posso doar hoje?": não é gravada, então não tem id. */
export type EligibilityCheckResponseDto = Omit<EligibilityAssessmentResponseDto, 'id' | 'appointmentId'>

export interface TemporaryUnfitnessDto {
  id: string
  donorId: string
  reason: string
  category: UnfitnessCategory
  startDate: string
  expectedEndDate: string | null
  actualEndDate: string | null
  registeredBy: string | null
  createdAt: string
}

export const CAMPAIGN_TYPES = ['REGULAR', 'URGENT'] as const
export type CampaignType = (typeof CAMPAIGN_TYPES)[number]

export interface CampaignDto {
  id: string
  title: string
  description: string
  type: CampaignType
  targetBloodType: BloodType | null
  collectionUnitId: string | null
  startDate: string
  endDate: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface CollectionUnitDto {
  id: string
  name: string
  address: string
  /** Null nas unidades cadastradas antes do campo existir. */
  neighborhood: string | null
  city: string
  uf: string
  phone: string
  simultaneousCapacity: number
  operatingHours: Record<string, string[]> | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface AppointmentDto {
  id: string
  donorId: string
  collectionUnitId: string
  campaignId: string | null
  dateTime: string
  status: AppointmentStatus
  assessmentEligibilityId: string | null
  /** Avisos da avaliação que confirmou o agendamento (ex.: menor deve levar o termo do responsável). */
  eligibilityNotices: AssessmentNotice[]
  cancellationReason: string | null
  /** Quando a presença foi confirmada (pelo doador ou por um admin); nulo enquanto não confirmou. */
  confirmedAt: string | null
  checkinAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

/** Resposta mínima de POST /appointments/confirm-attendance (confirmação pelo link do e-mail, sem login). */
export interface AttendanceConfirmationDto {
  id: string
  dateTime: string
  status: AppointmentStatus
  confirmedAt: string | null
}

export interface AppointmentCreatedDto extends AppointmentDto {
  eligibilityAssessment?: EligibilityAssessmentResponseDto
}

export interface SlotAvailabilityDto {
  dateTime: string
  occupiedSlots: number
  availableSlots: number
}

export interface AvailabilityQueryDto {
  collectionUnitId: string
  date: string
  simultaneousCapacity: number
  times: SlotAvailabilityDto[]
}

/** [LGPD] Payload de GET /donors/:id/export (ver DonorDataExport no eligibility-service). */
export interface DonorDataExportDto {
  donor: DonorResponseDto
  temporaryUnfitness: TemporaryUnfitnessDto[]
  eligibilityAssessments: EligibilityAssessmentResponseDto[]
}

export type AuditAction = 'VIEW' | 'UPDATE' | 'EXPORT' | 'ANONYMIZATION' | 'SEARCH'

/** Registro do log de auditoria de acesso ao perfil do doador (ver AccessAudit no eligibility-service). */
export interface AccessAuditDto {
  id: string
  donorId: string
  userId: string | null
  userRole: Role
  action: AuditAction
  createdAt: string
}

export interface ApiErrorBody {
  statusCode: number
  message: string | string[]
  error?: string
}
