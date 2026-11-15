import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router-dom'
import { useResetPassword } from '@/features/auth/hooks/useAuth'
import { type ResetPasswordFormValues, resetPasswordSchema } from '@/features/auth/schemas'
import { usePageTitle } from '@/shared/lib/usePageTitle'
import { Alert } from '@/shared/ui/Alert'
import { AuthPageLayout } from '@/shared/ui/AuthPageLayout'
import { Button } from '@/shared/ui/Button'
import { ErrorAlert } from '@/shared/ui/ErrorAlert'
import { InputField } from '@/shared/ui/Field'

export function ResetPasswordPage() {
  usePageTitle('Redefinir senha')
  const [searchParams] = useSearchParams()
  const resetPassword = useResetPassword()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token: searchParams.get('token') ?? '', newPassword: '', confirmPassword: '' },
  })

  return (
    <AuthPageLayout
      title="Redefinir senha"
      subtitle={'Cole o token recebido em "Esqueci minha senha" e escolha uma nova senha.'}
    >
      {resetPassword.isSuccess ? (
        <Alert variant="success">
          Senha redefinida com sucesso.{' '}
          <Link to="/login" className="font-medium underline">
            Entrar agora
          </Link>
        </Alert>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={handleSubmit((values) =>
            resetPassword.mutate({ token: values.token, newPassword: values.newPassword }),
          )}
        >
          <InputField label="Token" error={errors.token?.message} {...register('token')} />
          <InputField
            label="Nova senha"
            type="password"
            autoComplete="new-password"
            error={errors.newPassword?.message}
            {...register('newPassword')}
          />
          <InputField
            label="Confirmar nova senha"
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          <ErrorAlert error={resetPassword.error} fallback="Não foi possível redefinir a senha." />

          <Button type="submit" loading={resetPassword.isPending} className="mt-2 w-full">
            Redefinir senha
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-slate-500">
        <Link to="/login" className="font-medium text-red-600 hover:underline">
          Voltar para o login
        </Link>
      </p>
    </AuthPageLayout>
  )
}
