// Rótulos de tela (pt-BR) dos enums do backend: texto de apresentação, separado dos tipos de contrato.
import type {
  AppointmentStatus,
  AssessmentNotice,
  AuditAction,
  CampaignType,
  EligibilityResult,
  IneligibilityReason,
  Role,
  Sex,
  UnfitnessCategory,
} from './api'

export const SEX_LABEL: Record<Sex, string> = {
  F: 'Feminino',
  M: 'Masculino',
}

export const ROLE_LABEL: Record<Role, string> = {
  donor: 'Doador',
  admin: 'Admin',
}

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  SCHEDULED: 'Agendado',
  ELIGIBILITY_CONFIRMED: 'Elegibilidade confirmada',
  ELIGIBILITY_DENIED: 'Elegibilidade negada',
  CONFIRMED: 'Presença confirmada',
  CHECKIN_PERFORMED: 'Check-in realizado',
  COMPLETED: 'Concluído',
  CANCELED: 'Cancelado',
  NO_SHOW: 'Não compareceu',
}

export const ELIGIBILITY_RESULT_LABEL: Record<EligibilityResult, string> = {
  ELIGIBLE: 'Apto',
  TEMPORARY_UNFIT: 'Inapto temporariamente',
  PERMANENT_UNFIT: 'Inapto permanentemente',
}

export const INELIGIBILITY_REASON_LABEL: Record<IneligibilityReason, string> = {
  MIN_INTERVAL_NOT_FULFILLED: 'Intervalo mínimo entre doações não cumprido',
  AGE_BELOW_MIN: 'Idade abaixo do mínimo permitido',
  AGE_ABOVE_MAX:
    'A partir dos 70 anos, só doadores regulares, após avaliação médica (informe no seu perfil se é doador regular)',
  AGE_ABOVE_MAX_FIRST_DONATION:
    'De 60 a 69 anos, só pode doar quem já doou antes dos 60 (se você já doou, informe no seu perfil)',
  MAX_ANNUAL_DONATIONS_REACHED: 'Limite de doações nos últimos 12 meses atingido',
  GUARDIAN_CONSENT_REQUIRED:
    'Menores de 18 anos precisam informar o responsável legal e confirmar o termo de consentimento (no seu perfil)',
  MEDICAL_CLEARANCE_REQUIRED:
    'Avaliação médica do hemocentro pendente ou vencida (doadores com 70 anos ou mais; vale 12 meses)',
  INSUFFICIENT_WEIGHT: 'Peso abaixo do mínimo de 50 kg',
  ACTIVE_TEMPORARY_UNFITNESS: 'Inaptidão temporária ativa',
  PERMANENT_UNFIT: 'Inapto permanente',
}

export const UNFITNESS_CATEGORY_LABEL: Record<UnfitnessCategory, string> = {
  CLINIC: 'Clínica',
  BEHAVIORAL: 'Comportamental',
  LABORATORY: 'Laboratorial',
  OTHER: 'Outro',
}

export const CAMPAIGN_TYPE_LABEL: Record<CampaignType, string> = {
  REGULAR: 'Regular',
  URGENT: 'Urgente',
}

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  VIEW: 'Visualização do perfil',
  UPDATE: 'Atualização de dados',
  EXPORT: 'Exportação de dados (LGPD)',
  ANONYMIZATION: 'Anonimização de dados (LGPD)',
  SEARCH: 'Exibido na busca de doadores',
}

/** Os mesmos motivos, escritos para o admin (sobre o doador, com a regra que não foi cumprida). */
export const ADMIN_INELIGIBILITY_REASON_LABEL: Record<IneligibilityReason, string> = {
  MIN_INTERVAL_NOT_FULFILLED: 'Intervalo mínimo entre doações não cumprido (2 meses para homens, 3 para mulheres)',
  AGE_BELOW_MIN: 'Idade abaixo do mínimo de 16 anos',
  AGE_ABOVE_MAX: 'Tem 70 anos ou mais e não se declarou doador voluntário regular',
  AGE_ABOVE_MAX_FIRST_DONATION: 'Tem entre 60 e 69 anos e não declarou ter doado antes dos 60',
  MAX_ANNUAL_DONATIONS_REACHED: 'Limite de doações em 12 meses atingido (4 para homens, 3 para mulheres)',
  GUARDIAN_CONSENT_REQUIRED: 'Menor de 18 anos sem responsável legal ou termo de consentimento confirmado',
  MEDICAL_CLEARANCE_REQUIRED: 'Precisa da avaliação médica do hemocentro (70 anos ou mais): pendente ou vencida',
  INSUFFICIENT_WEIGHT: 'Peso abaixo do mínimo de 50 kg',
  ACTIVE_TEMPORARY_UNFITNESS: 'Inaptidão temporária em aberto',
  PERMANENT_UNFIT: 'Inaptidão permanente registrada',
}

export const ASSESSMENT_NOTICE_LABEL: Record<AssessmentNotice, string> = {
  BRING_GUARDIAN_CONSENT: 'Leve no dia da doação o termo de consentimento assinado pelo seu responsável legal.',
}
