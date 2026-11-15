import { useState } from 'react'
import { useDeleteMyAccount } from '@/features/auth'
import { ConfirmButton } from '@/shared/ui/ConfirmButton'
import { ErrorAlert } from '@/shared/ui/ErrorAlert'
import { InputField } from '@/shared/ui/Field'

/**
 * [LGPD] Exclusão da própria conta. Pede a senha atual (como a troca de e-mail): a exclusão não tem
 * volta, e uma sessão esquecida aberta não pode bastar para apagar a conta de alguém.
 */
export function DeleteAccountCard() {
  const deleteAccount = useDeleteMyAccount()
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)

  /** Sem a senha, a pergunta de confirmação nem aparece: o erro fica no campo. */
  function validatePassword(): boolean {
    if (!password) {
      setPasswordError('Informe sua senha atual para excluir a conta.')
      return false
    }
    setPasswordError(null)
    return true
  }

  return (
    <section
      aria-labelledby="delete-account"
      className="flex flex-col gap-3 rounded-xl border border-red-200 bg-white p-4 shadow-sm sm:p-6"
    >
      <h2 id="delete-account" className="text-xl font-bold text-red-700">
        Excluir minha conta
      </h2>
      <p className="text-sm text-slate-600">
        Seus dados pessoais (nome, CPF, telefone, e-mail) são anonimizados e você é desconectado na hora. A ação não
        pode ser desfeita.
      </p>
      <div className="sm:max-w-xs">
        <InputField
          label="Sua senha atual"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setPasswordError(null)
          }}
          error={passwordError ?? undefined}
        />
      </div>
      <ErrorAlert error={deleteAccount.error} fallback="Não foi possível excluir seus dados." />
      <div>
        <ConfirmButton
          question="Tem certeza? Essa ação é permanente."
          confirmLabel="Sim, excluir meus dados"
          loading={deleteAccount.isPending}
          validate={validatePassword}
          onConfirm={() => deleteAccount.mutate(password)}
        >
          Excluir minha conta
        </ConfirmButton>
      </div>
    </section>
  )
}
