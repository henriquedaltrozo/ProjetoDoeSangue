# 7. Contas de teste e cenários

Contas prontas para testar o sistema à mão e para demonstrações: uma conta por situação de
doação, um admin, duas unidades de coleta e três campanhas. São criadas pelo script
`backend/scripts/seed-scenarios.mjs`, que usa a API de verdade, então os dados passam pelas mesmas
regras de um uso real.

> Só para desenvolvimento. As senhas são de teste e estão escritas aqui de propósito.

## Como criar

1. Suba o sistema com a versão atual do código (o script usa rotas e campos novos, como o bairro
   da unidade e a inaptidão permanente):

   ```bash
   docker compose up --build -d
   ```

2. Rode o script, na pasta `backend`:

   ```bash
   pnpm seed:scenarios
   ```

O script lê do `.env` da raiz o `ADMIN_SETUP_TOKEN` (para criar o admin de teste quando ainda não
existe nenhum admin) e a `INTERNAL_API_KEY` (para registrar doações antigas). Se você já criou outro
admin, o token de instalação não serve mais; rode informando esse admin:

```bash
SEED_ADMIN_EMAIL=seu-admin@exemplo.com SEED_ADMIN_PASSWORD=sua-senha pnpm seed:scenarios
```

- **Pode rodar de novo:** o que já existe é reaproveitado; nada é apagado.
- **Pode demorar na primeira vez:** o cadastro aceita 10 tentativas a cada 15 minutos por IP
  (proteção contra abuso). Quando o limite é atingido, o script espera o tempo pedido pelo servidor
  e continua sozinho (cerca de 15 minutos para todas as contas).

## Acesso

| Conta | E-mail | Senha |
|---|---|---|
| Admin | `admin@doesangue.test` | `Teste@12345` |
| Doadores | `cenario-<nome>@doesangue.test` (tabela abaixo) | `Teste@12345` |

## Doadores e o que conferir

A situação para doar aparece no topo de **Agendar doação**. As idades são calculadas a partir do
dia em que o script roda.

| Conta (`cenario-…`) | Situação | O que deve aparecer |
|---|---|---|
| `apto` | 30 anos, 62 kg, A+, com telefone | "Você pode doar hoje" |
| `sem-tipo-sanguineo` | 27 anos, sem tipo sanguíneo | Pode doar; nenhuma campanha em destaque em Meus agendamentos |
| `intervalo-homem` | Homem, doou há 30 dias | "Você poderá doar a partir de…" (2 meses depois) · intervalo mínimo; o calendário bloqueia as datas antes |
| `intervalo-mulher` | Mulher, doou há 60 dias | "Você poderá doar a partir de…" (3 meses depois) · intervalo mínimo |
| `limite-anual-homem` | Homem, 4 doações nos últimos 12 meses | Limite de doações nos últimos 12 meses atingido |
| `limite-anual-mulher` | Mulher, 3 doações nos últimos 12 meses | Limite de doações nos últimos 12 meses atingido |
| `peso-baixo` | 45 kg | "No momento você não pode doar" · peso insuficiente; o botão de agendar fica desativado |
| `menor-15-anos` | 15 anos, responsável informado | "Você poderá doar a partir de…" (aos 16 anos) · idade abaixo do mínimo |
| `menor-17-com-termo` | 17 anos, termo confirmado | Pode doar, com o aviso de levar o termo assinado pelo responsável |
| `60-ja-doou` | 65 anos, doou antes dos 60 | Pode doar |
| `60-primeira-vez` | 63 anos, nunca doou antes dos 60 | Não pode doar (primeira doação após os 60) |
| `70-nao-regular` | 72 anos, não é doador regular | Não pode doar (a partir dos 70, só doadores regulares) |
| `70-sem-avaliacao` | 74 anos, doador regular | Avaliação médica pendente; no admin, o botão "Registrar avaliação médica favorável" |
| `70-com-avaliacao` | 71 anos, avaliação registrada pelo admin | Pode doar; no admin, a avaliação válida por 12 meses |
| `inaptidao-temporaria` | Tatuagem recente, 30 dias | "Você poderá doar a partir de…" · inaptidão temporária ativa |
| `inaptidao-permanente` | Inaptidão permanente registrada pelo admin | Inapto permanente, sem data; no admin, o motivo e o botão de desfazer |
| `agendado` | Agendamento amanhã às 10:00 | Em Agendar doação, o aviso de agendamento em aberto; em Meus agendamentos, "Confirmar presença" e "Cancelar" |
| `historico` | Um agendamento cancelado (com motivo) e uma doação concluída hoje (agendada para o próximo horário do dia, porque o check-in só vale no dia) | Meus agendamentos com os dois; a última doação passa a ser hoje e o intervalo bloqueia novas datas |
| `campanha-o-negativo` | Tipo O- | Em Meus agendamentos, o destaque da campanha urgente de O- |

Também ficam prontas:

- **Unidades:** "Hemocentro Centro (teste)", sem horário de funcionamento (aceita qualquer horário
  da grade), e "Unidade Bairro Novo (teste)", que atende de segunda a sexta (8h-12h e 13h-17h) e
  sábado (8h-12h). Escolher um domingo nesta mostra que não há horários.
- **Campanhas** (30 dias): urgente de O-, regular de A+ e uma regular para todos os tipos.

## Erros para testar à mão

| Onde | Como provocar | O que deve acontecer |
|---|---|---|
| Cadastro | Usar o CPF de uma conta de teste | "Já existe um doador cadastrado com este CPF ou usuário." |
| Cadastro | Data de nascimento de menor de 18 sem responsável | Os campos do responsável aparecem e são obrigatórios |
| Cadastro | Senhas diferentes, ou sem marcar o consentimento | Mensagem no campo; o cadastro não é enviado |
| Agendar | Conta `agendado` tenta outro agendamento | Aviso de agendamento em aberto; o botão fica desativado |
| Agendar | Conta `intervalo-homem` | Datas antes da liberada não podem ser escolhidas |
| Agendar | Unidade Bairro Novo num domingo | "Não há horários disponíveis nesta unidade neste dia" |
| Meu perfil | Trocar o e-mail com a senha errada | "Para trocar o e-mail, informe sua senha atual corretamente." |
| Meu perfil | Última doação anterior à registrada (conta `intervalo-mulher`) | "A data da última doação não pode ser anterior à já registrada…" |
| Login | Errar a senha 5 vezes seguidas | A conta fica bloqueada por 15 minutos |
| Admin | Registrar inaptidão permanente sem motivo | "Descreva o motivo da inaptidão permanente." |

O sistema não deixa criar algumas situações pelo cadastro, de propósito, e elas servem de teste de
erro: menor de 18 sem o termo do responsável e pessoa de 60 anos ou mais que não responde se já doou.
