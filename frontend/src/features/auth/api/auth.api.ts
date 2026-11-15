import { http } from '@/shared/api/http'
import type { AuthResponseDto, BloodType, Sex, UserResponseDto } from '@/shared/types'

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterDonorPayload {
  email: string
  password: string
  name: string
  cpf: string
  birthDate: string
  sex: Sex
  /** Opcional: DDD + número, só dígitos. */
  phone?: string
  weightKg: number
  /** Tipo sanguíneo, se o doador souber. */
  bloodType?: BloodType
  /** [LGPD] Consentimento para o uso dos dados de saúde: o cadastro só é aceito com true. */
  healthDataConsent: true
  /** Menores de 18 anos. */
  guardianName?: string
  guardianConsent?: boolean
  /** 60 anos ou mais. */
  donatedBefore60?: boolean
  /** 70 anos ou mais. */
  regularDonor?: boolean
  lastDonationDate?: string
}

export interface RegisterAdminPayload {
  email: string
  password: string
  name: string
}

export async function login(payload: LoginPayload): Promise<AuthResponseDto> {
  const { data } = await http.post<AuthResponseDto>('/auth/login', payload)
  return data
}

export async function registerDonor(payload: RegisterDonorPayload): Promise<AuthResponseDto> {
  const { data } = await http.post<AuthResponseDto>('/auth/register', payload)
  return data
}

/**
 * Cadastra um novo admin. Funciona sem token quando ainda não existe
 * nenhum admin no sistema (bootstrap - ver BootstrapOrAdminGuard no
 * auth-service) e o token de instalação é informado; depois disso exige
 * um admin autenticado.
 */
export async function registerAdmin({
  setupToken,
  ...payload
}: RegisterAdminPayload & { setupToken?: string }): Promise<UserResponseDto> {
  // Sem nenhum admin ainda, o servidor exige o token de instalação (ADMIN_SETUP_TOKEN).
  const { data } = await http.post<UserResponseDto>('/auth/admin', payload, {
    headers: setupToken ? { 'x-setup-token': setupToken } : undefined,
  })
  return data
}

export async function me(): Promise<UserResponseDto> {
  const { data } = await http.get<UserResponseDto>('/auth/me')
  return data
}

/** O refresh token é revogado pelo servidor a partir do cookie httpOnly; não há corpo. */
export async function logout(): Promise<void> {
  await http.post('/auth/logout')
}

export interface ForgotPasswordResponse {
  message: string
  /**
   * Só presente quando o e-mail existe e o envio de e-mails está desligado (sem SMTP, fora de
   * produção): o backend devolve o token aqui para o fluxo poder ser testado (ver
   * ForgotPasswordResponseDto no back-end). Com SMTP, o link só chega por e-mail.
   */
  resetToken?: string
}

export async function forgotPassword(email: string): Promise<ForgotPasswordResponse> {
  const { data } = await http.post<ForgotPasswordResponse>('/auth/forgot-password', { email })
  return data
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await http.post('/auth/reset-password', { token, newPassword })
}

export interface VerifyEmailResponse {
  /** O e-mail confirmado (numa troca, o novo e-mail da conta). */
  email: string
  /** true quando o link concluiu uma troca de e-mail. */
  changed: boolean
}

/** Confirma o e-mail pelo token do link (pública: o token é a credencial). */
export async function verifyEmail(token: string): Promise<VerifyEmailResponse> {
  const { data } = await http.post<VerifyEmailResponse>('/auth/verify-email', { token })
  return data
}

/** Reenvia o link de confirmação: para o e-mail novo, se há troca pendente; senão, para o atual. */
export async function resendVerification(): Promise<{ sentTo: string | null }> {
  const { data } = await http.post<{ sentTo: string | null }>('/auth/me/resend-verification')
  return data
}

export interface UpdateMePayload {
  name?: string
  email?: string
  /** Obrigatória para trocar o e-mail. */
  currentPassword?: string
}

/** Troca o nome e/ou o e-mail da própria conta (num doador, o perfil de doador acompanha). */
export async function updateMe(payload: UpdateMePayload): Promise<UserResponseDto> {
  const { data } = await http.patch<UserResponseDto>('/auth/me', payload)
  return data
}

/** [LGPD] Solicita a exclusão (anonimização) dos próprios dados, com a senha atual. Só para doadores. */
export async function deleteMyData(currentPassword: string): Promise<void> {
  await http.post('/auth/me/delete-data', { currentPassword })
}

/** [admin] Lista todos os usuários admin. */
export async function listAdmins(): Promise<UserResponseDto[]> {
  const { data } = await http.get<UserResponseDto[]>('/auth/admins')
  return data
}

/** [admin] Desativa outro admin (bloqueado para a própria conta e para o último admin ativo). */
export async function deactivateAdmin(id: string): Promise<UserResponseDto> {
  const { data } = await http.post<UserResponseDto>(`/auth/admins/${id}/deactivate`)
  return data
}

/** [admin] Reativa um admin previamente desativado. */
export async function reactivateAdmin(id: string): Promise<UserResponseDto> {
  const { data } = await http.post<UserResponseDto>(`/auth/admins/${id}/reactivate`)
  return data
}
