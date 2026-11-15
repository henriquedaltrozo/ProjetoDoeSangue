import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useRegisterAdmin } from '@/features/auth/hooks/useAuth'
import { type RegisterAdminFormInput, type RegisterAdminFormValues, registerAdminSchema } from '@/features/auth/schemas'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { ErrorAlert } from '@/shared/ui/ErrorAlert'
import { InputField } from '@/shared/ui/Field'

interface RegisterAdminFormProps {
  /**
   * Bootstrap do primeiro admin (sem sessão): pede o token de instalação, que o servidor exige
   * enquanto não existe nenhum admin (ADMIN_SETUP_TOKEN).
   */
  bootstrap?: boolean
}

/** Formulário de cadastro de admin, usado no bootstrap (público) e na gestão de admins (logado). */
export function RegisterAdminForm({ bootstrap = false }: RegisterAdminFormProps) {
  const registerAdmin = useRegisterAdmin()
  const [setupToken, setSetupToken] = useState('')
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<RegisterAdminFormInput, unknown, RegisterAdminFormValues>({
    resolver: zodResolver(registerAdminSchema),
    // Sem valores iniciais, o reset() depois do cadastro deixa os campos "alterados" (vazio ≠ undefined)
    // e o aviso de sucesso, que só aparece com o formulário limpo, nunca era mostrado.
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={handleSubmit((values) =>
        registerAdmin.mutate(bootstrap ? { ...values, setupToken } : values, {
          onSuccess: () => {
            reset()
            setSetupToken('')
          },
        }),
      )}
    >
      <InputField label="Nome completo" error={errors.name?.message} {...register('name')} />
      <InputField label="E-mail" type="email" error={errors.email?.message} {...register('email')} />
      <InputField
        label="Senha"
        type="password"
        autoComplete="new-password"
        error={errors.password?.message}
        {...register('password')}
      />
      <InputField
        label="Confirmar senha"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />

      {bootstrap && (
        <InputField
          label="Token de instalação"
          type="password"
          autoComplete="off"
          value={setupToken}
          onChange={(e) => setSetupToken(e.target.value)}
        />
      )}

      <ErrorAlert error={registerAdmin.error} fallback="Não foi possível cadastrar o admin." />
      {/* O aviso some quando o próximo cadastro começa a ser preenchido. */}
      {registerAdmin.isSuccess && !isDirty && (
        <Alert variant="success" onClose={() => registerAdmin.reset()}>
          Admin cadastrado com sucesso.
        </Alert>
      )}

      <Button type="submit" loading={registerAdmin.isPending}>
        Cadastrar admin
      </Button>
    </form>
  )
}
