// API pública da feature auth: só o que outras partes do app (app/, outras features) podem usar.

export type { UpdateMePayload } from './api/auth.api'
export { me } from './api/auth.api'
export { EmailVerificationBanner } from './components/EmailVerificationBanner'
export { useDeleteMyAccount, useLogout, useUpdateMe } from './hooks/useAuth'
