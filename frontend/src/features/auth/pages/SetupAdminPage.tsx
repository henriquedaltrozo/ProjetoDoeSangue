import { Link } from 'react-router-dom'
import { RegisterAdminForm } from '@/features/auth/components/RegisterAdminForm'
import { usePageTitle } from '@/shared/lib/usePageTitle'
import { AuthPageLayout } from '@/shared/ui/AuthPageLayout'

/**
 * Cadastro do primeiro admin do sistema. Rota pública de propósito: o back-end só aceita
 * POST /auth/admin sem login enquanto nenhum admin existe, e com o token de instalação
 * (BootstrapOrAdminGuard). Depois disso a chamada exige um admin autenticado, então a tela
 * pública só mostra o erro. Quem já está logado é redirecionado pela rota (PublicOnlyRoute):
 * admins cadastram outros admins em /admin/admins, dentro do menu.
 */
export function SetupAdminPage() {
  usePageTitle('Admin inicial')
  return (
    <AuthPageLayout
      title="Cadastrar admin inicial"
      subtitle="Use o token de instalação definido no servidor (ADMIN_SETUP_TOKEN)."
    >
      <RegisterAdminForm bootstrap />
      <p className="mt-6 text-center text-sm text-slate-500">
        <Link to="/login" className="font-medium text-red-600 hover:underline">
          Voltar para o login
        </Link>
      </p>
    </AuthPageLayout>
  )
}
