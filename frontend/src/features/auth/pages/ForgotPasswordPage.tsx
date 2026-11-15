import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { useForgotPassword } from '@/features/auth/hooks/useAuth'
import { type ForgotPasswordFormValues, forgotPasswordSchema } from '@/features/auth/schemas'
import { usePageTitle } from '@/shared/lib/usePageTitle'
import { Alert } from '@/shared/ui/Alert'
import { AuthPageLayout } from '@/shared/ui/AuthPageLayout'
import { Button } from '@/shared/ui/Button'
import { ErrorAlert } from '@/shared/ui/ErrorAlert'
import { InputField } from '@/shared/ui/Field'

export function ForgotPasswordPage() {
  usePageTitle('Esqueci minha senha')
  const forgotPassword = useForgotPassword()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(forgotPasswordSchema) })

  return (
    <AuthPageLayout
      title="Esqueci minha senha"
      subtitle="Informe o e-mail da sua conta para gerar um link de redefinição."
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit((values) => forgotPassword.mutate(values.email))}>
        <InputField
          label="E-mail"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />

        <ErrorAlert error={forgotPassword.error} fallback="Não foi possível processar o pedido." />

        {forgotPassword.isSuccess && (
          <Alert variant="success">
            <p>{forgotPassword.data.message}</p>
            {forgotPassword.data.resetToken && (
              <p className="mt-2">
                O envio de e-mails está desligado neste ambiente - use o link abaixo para continuar:{' '}
                <Link
                  to={`/password-reset?token=${encodeURIComponent(forgotPassword.data.resetToken)}`}
                  className="font-medium underline"
                >
                  Redefinir senha
                </Link>
              </p>
            )}
          </Alert>
        )}

        <Button type="submit" loading={forgotPassword.isPending} className="mt-2 w-full">
          Enviar
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        <Link to="/login" className="font-medium text-red-600 hover:underline">
          Voltar para o login
        </Link>
      </p>
    </AuthPageLayout>
  )
}
