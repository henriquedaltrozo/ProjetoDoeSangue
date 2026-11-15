import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePageTitle } from '@/shared/lib/usePageTitle'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Logo } from '@/shared/ui/Logo'

function Topic({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="flex flex-col gap-2 text-sm text-slate-700">{children}</div>
    </section>
  )
}

/** Explica, em linguagem simples, quais dados o sistema guarda, para quê e quais são os direitos do doador (LGPD). */
export function PrivacyPage() {
  usePageTitle('Como usamos seus dados')
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <Card className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div>
          <Logo className="text-lg" />
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Como usamos seus dados</h1>
          <p className="mt-1 text-sm text-slate-500">Um resumo, sem juridiquês, de acordo com a LGPD.</p>
        </div>

        <Topic title="O que guardamos">
          <ul className="list-inside list-disc">
            <li>
              <strong>Identificação:</strong> nome, CPF, data de nascimento e sexo.
            </li>
            <li>
              <strong>Contato:</strong> e-mail e, se você quiser, telefone.
            </li>
            <li>
              <strong>Saúde:</strong> peso, tipo sanguíneo, datas das doações, inaptidões registradas pelo hemocentro e
              as declarações que você faz (responsável legal, doação antes dos 60, doador regular).
            </li>
            <li>
              <strong>Agendamentos:</strong> unidade, data, horário e se você compareceu.
            </li>
          </ul>
        </Topic>

        <Topic title="Para que usamos">
          <p>
            Para saber se você pode doar (idade, peso e intervalo entre doações seguem as regras do Ministério da
            Saúde), agendar suas doações, lembrar você do horário e avisar sobre campanhas que precisam do seu tipo
            sanguíneo.
          </p>
          <p>
            Dados de saúde são dados sensíveis: só os usamos porque você consentiu no cadastro, e só para essas
            finalidades.
          </p>
          <p>
            A verificação de quando você pode doar, mostrada em "Agendar doação", não fica guardada. Guardamos só as
            avaliações que liberaram um agendamento, como registro.
          </p>
        </Topic>

        <Topic title="Quem vê">
          <p>
            Você e a equipe do hemocentro (administradores). Cada vez que alguém da equipe abre ou altera o seu
            cadastro, isso fica registrado.
          </p>
        </Topic>

        <Topic title="Seus direitos">
          <ul className="list-inside list-disc">
            <li>
              <strong>Ver e corrigir</strong> seus dados a qualquer momento em Meu perfil.
            </li>
            <li>
              <strong>Receber uma cópia</strong> de tudo o que guardamos (botão "Exportar meus dados").
            </li>
            <li>
              <strong>Excluir sua conta:</strong> nome, CPF, telefone e e-mail são apagados (anonimizados). Ficam só
              dados sem identificação, para as estatísticas do hemocentro.
            </li>
          </ul>
        </Topic>

        <div>
          <Button variant="secondary" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>
            Voltar
          </Button>
        </div>
      </Card>
    </div>
  )
}
