import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { useLogin } from '@/features/auth/hooks/useAuth'
import { type LoginFormValues, loginSchema } from '@/features/auth/schemas'
import { usePageTitle } from '@/shared/lib/usePageTitle'
import { AuthPageLayout } from '@/shared/ui/AuthPageLayout'
import { Button } from '@/shared/ui/Button'
import { ErrorAlert } from '@/shared/ui/ErrorAlert'
import { InputField } from '@/shared/ui/Field'
import { Logo } from '@/shared/ui/Logo'

export function LoginPage() {
  usePageTitle('Entrar')
  const login = useLogin()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) })

  return (
    <AuthPageLayout title={<Logo />} subtitle="Entre para agendar ou gerenciar doações.">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit((values) => login.mutate(values))}>
        <InputField
          label="E-mail"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <InputField
          label="Senha"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />

        <ErrorAlert error={login.error} fallback="Credenciais inválidas." />

        <Button type="submit" loading={login.isPending} className="mt-2 w-full">
          Entrar
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Ainda não tem conta?{' '}
        <Link to="/registration" className="font-medium text-red-600 hover:underline">
          Cadastre-se como doador
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-slate-500">
        <Link to="/password-forgot" className="font-medium text-red-600 hover:underline">
          Esqueci minha senha
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-slate-400">
        Configurando o sistema pela primeira vez?{' '}
        <Link to="/setup-admin" className="font-medium text-slate-500 hover:underline">
          Cadastre o admin inicial
        </Link>
      </p>
    </AuthPageLayout>
  )
}
