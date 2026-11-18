# Termo de consentimento do cadastro

Versão vigente: **2026-11-18** (`CONSENT_TERM_VERSION`, em `backend/shared/src/domain/consent/consent-term.ts`).

> **Minuta do autor, sem revisão jurídica.** A escolha da base legal cabe ao controlador do serviço. Antes de qualquer uso
> real, o texto e as bases abaixo precisam ser revistos por quem responde pelo tratamento dos dados.

## Como a versão é usada

- O cadastro (`POST /auth/register` e `POST /donors`) aceita o campo opcional `consentTermVersion`. Se for omitido, vale a
  versão vigente. Se citar outra versão, o cadastro é recusado (HTTP 400) e o doador precisa ler o termo atual.
- O doador é gravado com `healthDataConsentAt` (data e hora), `consentTermVersion`, `healthDataLegalBasis` e
  `personalDataLegalBasis`. Cadastros anteriores a essa versão ficam com os três últimos campos nulos.
- Ao mudar o texto abaixo, altere a constante `CONSENT_TERM_VERSION` e acrescente a nova versão neste arquivo, mantendo as
  anteriores para que se saiba o que cada doador aceitou.

## Bases legais gravadas

| Campo | Valor | Dados | Dispositivo da LGPD |
|---|---|---|---|
| `healthDataLegalBasis` | `LGPD_ART_11_I` | peso, tipo sanguíneo, histórico de doações, inaptidões e avaliações de elegibilidade | art. 11, I: consentimento específico e destacado, para finalidade específica |
| `personalDataLegalBasis` | `LGPD_ART_7_I` | nome, CPF, nascimento, sexo, telefone e e-mail | art. 7º, I: consentimento do titular |

## Texto da versão 2026-11-18

**Finalidade.** Seus dados são usados para agendar a doação de sangue, verificar se você atende aos critérios de elegibilidade
da Portaria GM/MS nº 11.685/2026 antes da ida ao hemocentro e avisar você por e-mail sobre agendamentos, lembretes e, se você
permitir, campanhas.

**Dados tratados.** Dados de identificação e contato (nome, CPF, data de nascimento, sexo, telefone e e-mail) e dados de saúde
informados por você (peso, tipo sanguíneo, datas de doação e declarações exigidas para a sua idade). Os dados de saúde são dados
pessoais sensíveis, e você consente com o uso deles de forma específica, para essa finalidade.

**Proteção.** Os dados são guardados cifrados. O acesso é restrito a você e à equipe do hemocentro, e cada consulta ao seu perfil
é registrada.

**Seus direitos.** Você pode acessar, corrigir e exportar seus dados e pedir a eliminação da sua conta, que anonimiza os dados
que identificam você (art. 18 da LGPD). Você pode retirar o consentimento a qualquer momento, o que impede novos agendamentos.

**Consentimento.** Ao se cadastrar, você declara que leu este termo e concorda com o tratamento descrito.
