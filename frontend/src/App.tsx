import { type ComponentType, lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/app/AppLayout'
import { ProtectedRoute } from '@/app/ProtectedRoute'
import { PublicOnlyRoute } from '@/app/PublicOnlyRoute'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { useAuthStore } from '@/shared/session/auth.store'
import { homePathFor } from '@/shared/session/homePath'
import { Spinner } from '@/shared/ui/Spinner'

/** Página carregada sob demanda: cada rota vira um chunk próprio (as páginas usam export nomeado). */
function lazyPage<M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M) {
  return lazy(() => load().then((m) => ({ default: m[name] as ComponentType })))
}

// O login fica no pacote inicial; o resto carrega sob demanda.
const RegisterDonorPage = lazyPage(() => import('@/features/auth/pages/RegisterDonorPage'), 'RegisterDonorPage')
const ForgotPasswordPage = lazyPage(() => import('@/features/auth/pages/ForgotPasswordPage'), 'ForgotPasswordPage')
const ResetPasswordPage = lazyPage(() => import('@/features/auth/pages/ResetPasswordPage'), 'ResetPasswordPage')
const VerifyEmailPage = lazyPage(() => import('@/features/auth/pages/VerifyEmailPage'), 'VerifyEmailPage')
const SetupAdminPage = lazyPage(() => import('@/features/auth/pages/SetupAdminPage'), 'SetupAdminPage')
const AdminsPage = lazyPage(() => import('@/features/auth/pages/AdminsPage'), 'AdminsPage')

const MyAppointmentsPage = lazyPage(
  () => import('@/features/scheduling/pages/MyAppointmentsPage'),
  'MyAppointmentsPage',
)
const SchedulePage = lazyPage(() => import('@/features/scheduling/pages/SchedulePage'), 'SchedulePage')
const ConfirmAttendancePage = lazyPage(
  () => import('@/features/scheduling/pages/ConfirmAttendancePage'),
  'ConfirmAttendancePage',
)
const AdminAppointmentsPage = lazyPage(
  () => import('@/features/scheduling/pages/AdminAppointmentsPage'),
  'AdminAppointmentsPage',
)
const AdminUnitsPage = lazyPage(() => import('@/features/scheduling/pages/AdminUnitsPage'), 'AdminUnitsPage')

const ProfilePage = lazyPage(() => import('@/features/eligibility/pages/ProfilePage'), 'ProfilePage')
const AdminDonorsPage = lazyPage(() => import('@/features/eligibility/pages/AdminDonorsPage'), 'AdminDonorsPage')
const AdminDonorDetailPage = lazyPage(
  () => import('@/features/eligibility/pages/AdminDonorDetailPage'),
  'AdminDonorDetailPage',
)

const AdminNotificationsPage = lazyPage(
  () => import('@/features/notifications/pages/AdminNotificationsPage'),
  'AdminNotificationsPage',
)

const UnsubscribePage = lazyPage(() => import('@/features/eligibility/pages/UnsubscribePage'), 'UnsubscribePage')

const PrivacyPage = lazyPage(() => import('@/app/PrivacyPage'), 'PrivacyPage')

const CampaignsPage = lazyPage(() => import('@/features/campaigns/pages/CampaignsPage'), 'CampaignsPage')
const AdminCampaignsPage = lazyPage(() => import('@/features/campaigns/pages/AdminCampaignsPage'), 'AdminCampaignsPage')

function HomeRedirect() {
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }
  return <Navigate to={homePathFor(user.role)} replace />
}

function App() {
  return (
    <Suspense fallback={<Spinner label="Carregando..." />}>
      <Routes>
        {/* Só para quem não está logado: com sessão, vai para a própria tela inicial. */}
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registration" element={<RegisterDonorPage />} />
          <Route path="/password-forgot" element={<ForgotPasswordPage />} />
          {/* Bootstrap do primeiro admin (exige o token de instalação - ver SetupAdminPage). */}
          <Route path="/setup-admin" element={<SetupAdminPage />} />
        </Route>
        {/* Links dos e-mails: públicos mesmo com sessão no navegador (o token do link é a credencial). */}
        <Route path="/confirm-attendance" element={<ConfirmAttendancePage />} />
        <Route path="/unsubscribe" element={<UnsubscribePage />} />
        <Route path="/password-reset" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        {/* Explicação sobre os dados (LGPD): aberta com ou sem sessão (o cadastro também aponta para ela). */}
        <Route path="/privacy" element={<PrivacyPage />} />

        <Route element={<ProtectedRoute allow={['donor']} />}>
          <Route element={<AppLayout />}>
            <Route path="/appointments" element={<MyAppointmentsPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/campaigns" element={<CampaignsPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allow={['admin']} />}>
          <Route element={<AppLayout />}>
            <Route path="/admin" element={<AdminAppointmentsPage />} />
            <Route path="/admin/units" element={<AdminUnitsPage />} />
            <Route path="/admin/donors" element={<AdminDonorsPage />} />
            <Route path="/admin/donors/:id" element={<AdminDonorDetailPage />} />
            <Route path="/admin/campaigns" element={<AdminCampaignsPage />} />
            <Route path="/admin/admins" element={<AdminsPage />} />
            <Route path="/admin/notifications" element={<AdminNotificationsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </Suspense>
  )
}

export default App
