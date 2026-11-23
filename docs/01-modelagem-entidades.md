# 01. Modelagem de entidades

Este documento descreve o modelo de dados implementado: um servidor PostgreSQL com **um banco por
microsserviço** (`auth_db`, `eligibility_db`, `scheduling_db`, `notification_db`), cada um com o schema
do seu serviço, e as entidades TypeORM de cada schema. O
código-fonte é a referência definitiva; este documento explica as decisões por trás dele. Vários
comentários no código (`Ver docs/01, seção X`) apontam de volta para as seções abaixo.

## 1. Princípio: um schema por serviço, sem foreign key entre schemas

Cada microsserviço é dono do seu schema Postgres (`auth`, `eligibility`, `scheduling`,
`notification`) e só lê/escreve nas suas próprias tabelas. Quando uma entidade de um schema
precisa "apontar" para uma entidade de outro schema (ex.: um `appointment` do `scheduling`
precisa saber a qual `donor` do `eligibility` ele pertence), isso é uma **referência lógica**:
uma coluna `uuid` guardando o id, sem `FOREIGN KEY` de fato entre os schemas.

Essa escolha é deliberada, não uma limitação: manter uma FK cross-schema acoplaria o schema de um
serviço ao ciclo de vida de outro (migração, deploy, teste isolado) e um microsserviço deveria
poder, em tese, rodar contra seu próprio banco dedicado - o fato de compartilharem uma instância
Postgres aqui é só para simplificar a operação do projeto (um Postgres só para subir), não uma
premissa de arquitetura. A consistência entre serviços é garantida via chamada HTTP síncrona
validada (ex.: `auth-service` → `eligibility-service` ao cadastrar um doador, com uma chave
interna - ver seção 7) mais um **padrão de compensação**: se a chamada ao outro serviço falhar
depois de já ter escrito localmente, a escrita local é desfeita (rollback manual), em vez de
tentar uma transação distribuída entre bancos/serviços diferentes. Esse padrão aparece em dois
lugares:

- `auth-service`, ao registrar um doador: se a chamada para criar o `Donor` no
  `eligibility-service` falhar, o `User` recém-criado é apagado (`RegisterDonorUseCase`, em `backend/application/auth/use-cases/register-donor.use-case.ts`).
- `scheduling-service`, ao criar um agendamento: se a chamada de avaliação de elegibilidade ao
  `eligibility-service` falhar (não "negar" - falhar mesmo), a reserva de vaga já feita é desfeita
  (`CreateAppointmentUseCase`, em `backend/application/scheduling/use-cases/appointment/create-appointment.use-case.ts`).

## 2. Visão geral

| Schema         | Serviço                | Entidades                                                        |
| -------------- | ----------------------- | ------------------------------------------------------------------ |
| `auth`          | auth-service             | `users`, `refresh_tokens`, `password_reset_tokens`                  |
| `eligibility`    | eligibility-service       | `donors`, `temporary_unfitness`, `eligibility_assessments`, `audit_accesses` |
| `scheduling`     | scheduling-service        | `collection_units`, `campaigns`, `appointments`                        |
| `notification`   | notification-service      | `sent_notifications`                                              |

## 3. Schema `auth`

Credenciais e controle de acesso. Dados cadastrais/clínicos do doador **não** vivem aqui - vivem
em `eligibility.donors` (ver seção 4).

### 3.1 `users`

| Coluna           | Tipo                       | Observação                                              |
| ----------------- | --------------------------- | ---------------------------------------------------------- |
| `id`               | uuid (PK)                    |                                                              |
| `email`             | text (cifrado 🔒)               | o e-mail único e a busca usam `emailIndex` |
| `emailIndex`        | varchar(64), único             | HMAC-SHA-256 do e-mail normalizado (índice cego, seção 8.1) |
| `passwordHash`       | varchar(255)                  | bcrypt                                                       |
| `role`               | enum (`donor`, `admin`)        |                                                              |
| `name`               | text (cifrado 🔒)               |                                                              |
| `donorId`           | uuid, nullable                | referência lógica a `eligibility.donors.id`; `null` para admins |
| `active`              | boolean, default `true`         |                                                              |
| `loginFailures`          | int, default `0`                | falhas de login seguidas; zera no sucesso ou ao bloquear      |
| `blockedUntil`          | timestamptz, nullable          | enquanto no futuro, o login responde 429 (bloqueio de 15 min após 5 falhas) |
| `emailVerifiedAt`       | timestamptz, nullable          | quando o e-mail foi confirmado pelo link; nulo = não confirmado (o doador não agenda). Admins nascem confirmados |
| `pendingEmail`          | text, nullable (cifrado 🔒)    | e-mail novo pedido em Meu perfil, à espera da confirmação pelo link; até lá, vale `email` |
| `lastLoginAt`       | timestamptz, nullable          |                                                              |
| `createdAt`/`updatedAt` | timestamptz                  |                                                              |

### 3.2 `refresh_tokens`

| Coluna       | Tipo                | Observação                                    |
| ------------- | -------------------- | -------------------------------------------------- |
| `id`           | uuid (PK)              |                                                      |
| `userId`     | uuid (FK → `users`) | FK normal - mesma tabela, mesmo schema                |
| `tokenHash`      | varchar(64), único       | SHA-256 do refresh token; o token em si nunca é persistido |
| `expiresAt`      | timestamptz             |                                                      |
| `revokedAt`      | timestamptz, nullable    | setado no logout ou ao ser trocado por um novo access token |
| `createdAt`      | timestamptz             |                                                      |

### 3.3 `password_reset_tokens`

Tokens de redefinição de senha (`POST /auth/forgot-password` / `POST /auth/reset-password`) -
mesmo padrão de `refresh_tokens`: só o hash SHA-256 é persistido, nunca o token em texto puro.

| Coluna       | Tipo                | Observação                                                        |
| ------------- | -------------------- | ------------------------------------------------------------------- |
| `id`           | uuid (PK)              |                                                                       |
| `userId`     | uuid (FK → `users`) |                                                                       |
| `tokenHash`      | varchar(64), único       | SHA-256 do token; validade de 15min                                    |
| `expiresAt`      | timestamptz             |                                                                       |
| `usedAt`         | timestamptz, nullable    | setado quando o token é consumido em `POST /auth/reset-password` (uso único) |
| `createdAt`      | timestamptz             |                                                                       |

`POST /auth/forgot-password` sempre enfileira (best-effort, via BullMQ - ver seção 6) um e-mail
de redefinição com o link e o token; o token só volta também na própria resposta da API
(`resetToken`) quando nenhum provedor SMTP real está configurado (`SMTP_HOST` vazio) - o modo
"simulado" que este projeto sempre teve, mantido como padrão para não exigir credenciais reais em
dev/CI. Configurando `SMTP_HOST` (e demais `SMTP_*`, ver `.env.example`) o e-mail passa a ser
enviado de verdade (via `NodemailerMailSender`, Nodemailer/SMTP - compatível com SendGrid, SES, Gmail,
Mailtrap, ...) e o token deixa de aparecer na resposta, por segurança. Em produção
(`NODE_ENV=production`) o token nunca volta na resposta, mesmo sem SMTP: senão qualquer pessoa que
soubesse um e-mail trocaria a senha da conta. Nesse caso o link fica só no log do auth-service.

A validade curta (15min, reduzida a partir de um 1h inicial) e o rate limiting em
`POST /auth/forgot-password` (5 requisições / 15min por IP) e `POST /auth/reset-password` (10
requisições / 15min por IP, via `@nestjs/throttler`) reduzem a janela de exposição do token e
dificultam automatizar tentativas contra o fluxo - ver seção 8.2.

## 4. Schema `eligibility`

Dono dos dados cadastrais/clínicos do doador e do motor de regras de elegibilidade (regras
completas: ver `03-regras-elegibilidade.md`).

### 4.1 `donors`

| Coluna                    | Tipo                        | Observação                                    |
| --------------------------- | ---------------------------- | -------------------------------------------------- |
| `id`                         | uuid (PK)                      |                                                      |
| `userId`                   | uuid, único                     | referência lógica a `auth.users.id`                |
| `completeName`                 | text (cifrado 🔒)                |                                                      |
| `nameIndexes`                  | text[] (GIN)                    | HMAC de cada palavra do nome, sem acento e em minúsculas (índice cego, seção 8.1) |
| `cpf`                          | text (cifrado 🔒)                | só dígitos antes de cifrar                              |
| `cpfIndex`                     | varchar(64), único               | HMAC-SHA-256 do CPF (índice cego); garante a unicidade e a busca exata |
| `birthDate`                | text (cifrado 🔒)                | data ISO `AAAA-MM-DD` antes de cifrar                   |
| `sex`                          | enum (`M`, `F`)                   |                                                      |
| `phone`                        | text, nullable (cifrado 🔒)       | opcional: o doador pode informar no cadastro (só dígitos, DDD + número) ou depois, e altera ou apaga no perfil, via `PATCH /donors/:id`; vazio após a anonimização |
| `email`                        | text (cifrado 🔒)                 | o e-mail de contato, copiado do cadastro da conta |
| `weightKg`                         | varchar (cifrado 🔒)              | não editável após o cadastro (afeta elegibilidade)      |
| `bloodType`                  | varchar, nullable (cifrado 🔒, determinístico) | opcional no cadastro ("se souber"); editável depois |
| `healthDataConsentAt`        | timestamptz, nullable            | [LGPD] quando o doador consentiu com o uso dos dados de saúde; o cadastro só é aceito com o consentimento (nulo em cadastros anteriores a ele) |
| `consentTermVersion`         | varchar(20), nullable            | [LGPD] versão do termo aceito no cadastro (texto em `10-termo-consentimento.md`); um cadastro que cita outra versão é recusado; nulo em cadastros anteriores |
| `healthDataLegalBasis`       | varchar(20), nullable            | [LGPD] base legal dos dados de saúde: `LGPD_ART_11_I` (consentimento específico) |
| `personalDataLegalBasis`     | varchar(20), nullable            | [LGPD] base legal dos demais dados pessoais: `LGPD_ART_7_I` (consentimento) |
| `emailVerified`              | boolean, default `true`          | espelho da confirmação do e-mail no auth (`false` num cadastro novo até o link ser aberto): sem ela, o doador não recebe campanha nem "já pode doar" |
| `receiveAlerts`              | boolean, default `true`          | aceita e-mails de campanhas urgentes e de "você já pode doar" (desmarcado em Meu perfil); os e-mails de agendamento e de segurança da conta saem sempre |
| `lastDonationAt`                 | date, nullable                   | informado (opcional) no cadastro; atualizado internamente ao concluir uma doação |
| `guardianName`                   | text, nullable (cifrado 🔒)       | menores de 18: responsável legal declarado              |
| `guardianConsentDeclared`        | boolean, default `false`          | menores de 18: confirmou que levará o termo assinado    |
| `donatedBefore60`                | boolean, nullable                 | 60 anos ou mais: declarou ter doado antes dos 60 (`null` = não respondeu) |
| `regularDonorDeclared`           | boolean, default `false`          | 70 anos ou mais: declarou ser doador voluntário regular |
| `medicalClearanceAt`, `medicalClearanceBy` | date / uuid, nullable   | 70 anos ou mais: avaliação médica favorável registrada pelo admin; vale 12 meses |
| `permanentUnfit`                | boolean, default `false`          |                                                      |
| `permanentUnfitnessReason`        | text, nullable (cifrado 🔒)        |                                                      |
| `active`                          | boolean, default `true`           |                                                      |
| `version`                         | integer, default `1`              | concorrência otimista (o repositório confere a versão lida antes de gravar) |
| `createdAt`/`updatedAt`            | timestamptz                      |                                                      |

`weightKg`, `birthDate` e `cpf` são deliberadamente **não editáveis** via API depois do
cadastro: são exatamente os campos usados no cálculo de elegibilidade (idade e peso mínimos), e
permitir edição livre abriria uma forma de burlar o motor de regras. `phone` e `bloodType`
não entram nesse cálculo, então podem ser atualizados livremente.

A altura não é coletada: nenhuma regra a usava (o critério da Portaria é só o peso mínimo), e pelo
princípio da minimização da LGPD um dado de saúde sem uso não deve ser coletado. A migration
`1762200000000-health-consent-drop-height` removeu a coluna.

🔒 = criptografado em repouso (ver seção 8.1). A busca administrativa de doadores aceita o CPF completo
(pelo `cpfIndex`) ou palavras inteiras do nome (por `nameIndexes`); não há busca por fragmento, pois o valor
cifrado não pode ser comparado pelo banco. Cada consulta fica no log de auditoria (seção 4.4).

### 4.2 `temporary_unfitness`

Períodos de inaptidão temporária (tatuagem recente, gravidez, viagem a área de risco de malária
etc.), registrados pelo admin. Cada período é uma linha; **não existe um flag booleano
"inapto agora"** persistido - se o doador está inapto neste exato momento é *calculado* a partir
das datas, toda vez que a elegibilidade é avaliada (ver `03-regras-elegibilidade.md`, seção sobre
inaptidão temporária).

| Coluna              | Tipo                          | Observação                                   |
| --------------------- | ------------------------------ | ------------------------------------------------- |
| `id`                    | uuid (PK)                        |                                                     |
| `donorId`               | uuid (FK → `donors`)             |                                                     |
| `reason`                 | text (cifrado 🔒)                  | texto livre digitado pelo admin                      |
| `category`              | enum (`CLINIC`, `BEHAVIORAL`, `LABORATORY`, `OTHER`) | |
| `startDate`             | date                              |                                                     |
| `expectedEndDate`         | date, nullable                     | estimativa; se `null`, o período fica em aberto até uma `actualEndDate` ser lançada |
| `actualEndDate`            | date, nullable                     | setado ao encerrar antecipadamente um período em aberto (`PATCH /donors/:id/unfitness/:unfitnessId/end`, admin): o dia em que o doador fica liberado |
| `registeredBy`          | uuid, nullable                     | id do admin (`auth.users.id`) que registrou        |
| `createdAt`              | timestamptz                        |                                                     |

Um período está "ativo hoje" quando `startDate <= hoje` **e**, se encerrado, `hoje < actualEndDate`;
senão, `expectedEndDate` é nulo ou `hoje <= expectedEndDate` - a query exata está em
`UnfitnessRepository.findActive`.

### 4.3 `eligibility_assessments`

Log auditável das verificações de elegibilidade que decidem algo (a entidade "Elegibilidade" da
modelagem original): a validação de cada agendamento/check-in e a reavaliação pós-doação. Nunca é
atualizada, só inserida. A consulta do doador ("Posso doar hoje?") só responde e não é gravada:
guardar cada clique não tem finalidade, e a LGPD pede não reter dado de saúde sem necessidade (a
migration `1762400000000` apagou as já gravadas). As avaliações não aparecem em
tela (o painel mostra só a situação atual do doador); servem de registro, ficam disponíveis em
`GET /eligibility/:donorId/history` (admin) e o doador as recebe na exportação de dados.

| Coluna                    | Tipo                                          | Observação                                       |
| --------------------------- | ------------------------------------------------ | ------------------------------------------------------- |
| `id`                         | uuid (PK)                                          |                                                          |
| `donorId`                    | uuid (FK → `donors`)                               |                                                          |
| `appointmentId`                | uuid, nullable                                      | referência lógica a `scheduling.appointments.id`, quando a avaliação foi disparada por um agendamento |
| `result`                    | enum (`ELIGIBLE`, `TEMPORARY_UNFIT`, `PERMANENT_UNFIT`) |                                                          |
| `reasons`                       | jsonb (array de `IneligibilityReason`)              | vazio quando `ELIGIBLE`                                       |
| `notices`                       | jsonb (array de `AssessmentNotice`), default `[]`   | avisos de uma avaliação apta (ex.: levar o termo do responsável) |
| `nextEligibilityDate`        | date, nullable                                      | a maior das datas candidatas entre os motivos (ver `03-regras-elegibilidade.md`) |
| `origin`                        | enum (`DONOR_QUERY`, `APPOINTMENT_VALIDATION`)     | quem disparou a avaliação                                  |
| `assessedAt`                    | timestamptz                                         |                                                          |

### 4.4 `audit_accesses`

Trilha de auditoria de quem acessou/alterou o perfil de qual doador (LGPD - ver seção 8.3). Só
insere, nunca atualiza ou apaga; uma falha ao gravar aqui nunca derruba a operação principal
(`AuditoriaService#registrar` captura e loga qualquer erro).

| Coluna         | Tipo                                                                 | Observação                                              |
| ---------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------ |
| `id`               | uuid (PK)                                                                 |                                                                |
| `donorId`           | uuid, indexado                                                              |                                                                |
| `userId`           | uuid, nullable                                                                | quem acessou; nulo só na anonimização (chamada interna, sem usuário autenticado no eligibility-service) |
| `userRole`         | enum (`donor`, `admin`)                                                         | papel de quem acessou no momento do acesso                       |
| `action`                   | enum (`VIEW`, `UPDATE`, `EXPORT`, `ANONYMIZATION`, `SEARCH`)       | `SEARCH`: o doador apareceu numa busca do admin (nome e CPF exibidos) |
| `createdAt`                | timestamptz                                                                    |                                                                |

Consultável via `GET /donors/:id/audit` (admin) - ver `04-contratos-api.md`.

## 5. Schema `scheduling`

### 5.1 `collection_units`

| Coluna                   | Tipo                                | Observação                              |
| --------------------------- | -------------------------------------- | ------------------------------------------ |
| `id`                          | uuid (PK)                                |                                              |
| `name`, `address`, `city`, `uf`, `phone` | varchar                    |                                              |
| `neighborhood`                 | varchar(100), nullable           | bairro; obrigatório no cadastro de unidades novas, nulo nas cadastradas antes do campo existir |
| `simultaneousCapacity`          | integer                                  | quantas coletas simultâneas cabem por horário |
| `operatingHours`           | jsonb, nullable                           | reservado para uso futuro (não usado no motor de disponibilidade atual, que trabalha por horário exato) |
| `active`                          | boolean, default `true`                    | uma unidade desativada some da listagem pública, mas não é apagada (histórico de agendamentos antigos continua íntegro); pode ser reativada (`POST /collection-units/:id/reactivate`, admin) |
| `createdAt`/`updatedAt`            | timestamptz                                |                                              |

### 5.2 `campaigns`

Campanhas de doação (regulares, urgentes, ou de um tipo sanguíneo específico), criadas pelo
admin. Campanhas `URGENT` disparam, na criação, uma notificação
assíncrona (BullMQ) para os doadores ativos compatíveis - ver `02-diagramas-sequencia.md`.

| Coluna                | Tipo                                                       | Observação                          |
| ------------------------ | ------------------------------------------------------------ | --------------------------------------- |
| `id`                      | uuid (PK)                                                       |                                          |
| `title`                    | varchar(150)                                                    |                                          |
| `description`                  | text                                                             |                                          |
| `type`                        | enum (`REGULAR`, `URGENT`)                                        | regular: incentivo, sem aviso; urgente: avisa os doadores na criação |
| `targetBloodType`             | enum, nullable                                                    | opcional nos dois tipos; vazio = todos os tipos sanguíneos (o aviso da urgente vai só para o tipo, quando informado) |
| `collectionUnitId`               | uuid, nullable (FK → `collection_units`, `ON DELETE SET NULL`)        | opcional - `null` = campanha vale para todas as unidades |
| `startDate`, `endDate`           | date                                                              |                                          |
| `active`                          | boolean, default `true`                                            | desativada pelo admin, não apagada        |
| `createdAt`/`updatedAt`            | timestamptz                                                        |                                          |

### 5.3 `appointments`

A entidade central do fluxo do doador. Um agendamento referencia logicamente um doador
(`eligibility.donors`, sem FK - ver seção 1), tem FK de verdade para `collection_units` (mesmo
schema) e opcionalmente para `campaigns`.

| Coluna                       | Tipo                                                                                                            | Observação |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------- |
| `id`                              | uuid (PK)                                                                                                             |             |
| `donorId`                         | uuid                                                                                                                    | referência lógica; indexado |
| `collectionUnitId`                    | uuid (FK → `collection_units`, `ON DELETE RESTRICT`)                                                                      | não é possível apagar uma unidade com agendamentos |
| `campaignId`                          | uuid, nullable (FK → `campaigns`, `ON DELETE SET NULL`)                                                                    | opcional - agendamento "vinculado" a uma campanha |
| `dateTime`                              | timestamptz                                                                                                             |             |
| `status`                                  | enum, default `SCHEDULED`                                                                                                 | ver máquina de estados abaixo |
| `assessmentEligibilityId`                  | uuid, nullable                                                                                                          | referência lógica a `eligibility.eligibility_assessments.id` |
| `eligibilityNotices`                       | jsonb (array de `AssessmentNotice`), default `[]`                                                                       | avisos da avaliação que confirmou o agendamento (ex.: menor deve levar o termo do responsável) |
| `cancellationReason`                          | text, nullable                                                                                                        |             |
| `confirmedAt`                                | timestamptz, nullable                                                                                                  | preenchido quando o doador (ou um admin) confirma a presença |
| `checkinAt`, `completedAt`                       | timestamptz, nullable                                                                                              |             |
| `createdAt`/`updatedAt`                             | timestamptz                                                                                                       |             |

Índice composto `(collectionUnitId, dateTime)`: é exatamente a consulta usada para checar
disponibilidade (`GET /appointments/availability`) e para o lock de concorrência abaixo.

`dateTime` segue a grade de 30 em 30 minutos (a capacidade da unidade vale por horário exato) e, se a
unidade cadastrou `operatingHours`, cai dentro de uma das faixas do dia. Um doador só tem um
agendamento em aberto por vez: `CHECKIN_PERFORMED`, ou `SCHEDULED`/`ELIGIBILITY_CONFIRMED`/`CONFIRMED`
com horário ainda por vir.

**Máquina de estados de `status`** (diagrama completo: `02-diagramas-sequencia.md`):

```
SCHEDULED → ELIGIBILITY_CONFIRMED → CONFIRMED → CHECKIN_PERFORMED → COMPLETED
        ↘ ELIGIBILITY_DENIED
ELIGIBILITY_CONFIRMED → CONFIRMED     (confirmação de presença; idempotente)
ELIGIBILITY_CONFIRMED | CONFIRMED → CHECKIN_PERFORMED  (depois de reavaliar a elegibilidade para hoje)
SCHEDULED | ELIGIBILITY_CONFIRMED | CONFIRMED → CANCELED  (doador: antes do horário; admin: a qualquer momento)
CHECKIN_PERFORMED → CANCELED  (só admin, ex.: a triagem clínica recusou)
ELIGIBILITY_CONFIRMED | CONFIRMED → NO_SHOW  (só depois que dateTime já passou; POST /appointments/:id/no-show, admin)
```

**Confirmação de presença**: `CONFIRMED` conta como vaga ocupada, como `ELIGIBILITY_CONFIRMED`.
Quem não confirma continua com a vaga (não há cancelamento automático); o estado "aguardando
confirmação" é derivado (status `ELIGIBILITY_CONFIRMED` + faltando menos de 48h), não é um status.
O doador recebe um e-mail de pedido 48h antes e um lembrete 24h antes, ambos com um link
(`FRONTEND_URL/confirm-attendance?token=...`) válido até o horário do agendamento. O token é um HMAC-SHA256
com chave derivada de `JWT_SECRET` e não serve como JWT de sessão.

`SCHEDULED` é transitório: a criação do agendamento já dispara a avaliação de elegibilidade de
forma síncrona (dentro da mesma requisição), então na prática o estado que o cliente vê logo após
criar é sempre `ELIGIBILITY_CONFIRMED` ou `ELIGIBILITY_DENIED`.

**Observação de design - controle de vagas por horário**: em vez de uma tabela extra de "posições"
reservadas, a checagem de vagas disponíveis e a criação do agendamento são serializadas com um
[advisory lock](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS) do
Postgres (`pg_advisory_xact_lock`), escopado à transação e liberado automaticamente no
commit/rollback, usando como chave o par `(collectionUnitId, dateTime)`. Isso evita overbooking sob
concorrência (duas requisições simultâneas tentando o último horário disponível) sem o custo de
uma tabela adicional só para isso - ver `AgendamentosService.reservarComLock`.

## 6. Schema `notification`

Na modelagem original este schema foi deixado "em aberto" (a estratégia de notificação seria
definida junto com a implementação do worker BullMQ). Ficou assim:

### 6.1 `sent_notifications`

Registro auditável de cada notificação processada pelo worker (`NotificationsProcessor`), sucesso
ou falha - permite ao admin (ou a uma futura tela de auditoria) ver o que foi de fato enviado, e
serve de base para eventuais retentativas manuais.

| Coluna         | Tipo                                                                          | Observação                                        |
| ---------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `id`               | uuid (PK)                                                                           |                                                            |
| `donorId`           | uuid, nullable                                                                       | referência lógica a `eligibility.donors.id`; `null` para notificações que não são sobre um doador (`RESET_PASSWORD`) |
| `userId`           | uuid, nullable                                                                       | referência lógica a `auth.users.id`; preenchida quando a notificação é sobre a conta, não sobre o doador (`RESET_PASSWORD`, vale para admin também) |
| `type`                | enum (`reminder-24h`, `attendance-confirmation`, `appointment-booked`, `appointment-canceled`, `interval-completed`, `eligible-again`, `urgent-campaign`, `reset-password`, `password-changed`, `email-changed`) | mesmo enum usado como nome do job BullMQ |
| `channel`                | enum, default `EMAIL`                                                                 | preparado para outros canais (SMS, push) - só e-mail implementado hoje |
| `recipient`          | varchar(255)                                                                          |                                                            |
| `subject`                | varchar(255)                                                                          |                                                            |
| `message`                | text                                                                                 | no `RESET_PASSWORD`, gravado com o link sem o token; apagado (com `recipient`) quando o titular exclui a conta |
| `status`                  | enum (`SENT`, `FALHOU`)                                                             |                                                            |
| `error`                      | text, nullable                                                                      | mensagem de erro quando `status = FALHOU`                    |
| `jobId`                      | varchar(100), nullable                                                              | id do job BullMQ correspondente                             |
| `sentAt`                    | timestamptz                                                                       |                                                            |

Envio real de e-mail via `NodemailerMailSender` (`backend/services/notification/src/infrastructure/mail`) - Nodemailer sobre
SMTP, compatível com qualquer provedor que exponha esse protocolo (SendGrid, SES, Gmail,
Mailtrap, ...) sem SDK específico de vendor, então trocar de provedor é só trocar variáveis de
ambiente (`SMTP_*`, ver `.env.example`). No docker-compose, o padrão é o Mailpit (caixa de teste local,
http://localhost:8025). Sem `SMTP_HOST` (serviços rodando fora do Docker, CI), o envio é só simulado:
loga o que seria enviado e grava o registro normalmente, com `status = SENT`. Uma falha real de envio
(SMTP configurado mas indisponível, credenciais inválidas, etc.) fica registrada como `FAILURE`, com o
motivo em `error`, e o job é tentado de novo pelo BullMQ (10 tentativas com backoff exponencial, cobrindo cerca de 4 h); numa nova
tentativa, só recebe o e-mail quem ainda não o recebeu naquele job, então não há duplicidade. `scheduling-service` e `auth-service` produzem na fila `notifications` cada um pelo seu adaptador
(`NotificationQueuePublisher` e `NotificationsQueuePublisher`); o do auth é usado por `POST /auth/forgot-password` para o
e-mail de redefinição de senha - ver seção 3.3.

## 7. Autenticação e autorização entre serviços

- **JWT (usuário final)**: emitido pelo `auth-service` no login/registro, validado por cada
  serviço via `SharedAuthModule` (segredo compartilhado via `JWT_SECRET`, evitando uma chamada
  extra ao `auth-service` a cada requisição). Guards: `JwtAuthGuard` (exige um token válido) +
  `RolesGuard`/`@Roles(...)` (restringe por papel).
- **`InternalApiKeyGuard`**: protege endpoints que só devem ser chamados por outro serviço, nunca
  pelo frontend (ex.: `POST /donors` interno, usado pelo `auth-service` ao registrar um doador;
  `GET /donors/internal/contacts`, usado pelo `scheduling-service` para montar notificações de
  campanha). Valida um header `x-internal-api-key` contra `INTERNAL_API_KEY` (variável de
  ambiente compartilhada, nunca exposta ao cliente).
- **`BootstrapOrAdminGuard`**: resolve o problema de "como criar o primeiro admin do sistema".
  Estende o guard de JWT+role admin normal, mas libera a requisição sem autenticação **enquanto
  nenhum admin existir** no banco (`AuthService.existsAdmin()`), mas só para quem enviar o header
  `x-setup-token` igual a `ADMIN_SETUP_TOKEN` (comparação em tempo constante); sem a variável
  configurada o bootstrap fica fechado. Assim que o primeiro admin é criado, o mesmo endpoint
  volta a exigir um admin autenticado - não fica um buraco de segurança aberto. O front espelha
  essa regra: `/setup-admin` é pública e pede o token de instalação enquanto não há sessão.

## 8. Proteção de dados sensíveis (LGPD)

O sistema lida com dados de saúde (tipo sanguíneo, peso, motivos de inaptidão) e dados pessoais
identificantes (nome, CPF, contato) do doador. Esta seção documenta os controles adicionados sobre
esses dados, além do que já é padrão no projeto (bcrypt para senhas, hash SHA-256 para tokens).

### 8.1 Criptografia em repouso

`backend/shared/src/infrastructure/persistence/crypto/encrypted-column.transformer.ts` expõe `encryptedColumn(...)`, um
`ValueTransformer` do TypeORM (AES-256-GCM, com etiqueta de autenticação: valor adulterado no banco falha na leitura) aplicado às colunas de saúde do `eligibility-service`:
`donors.completeName`, `donors.cpf`, `donors.birthDate`, `donors.phone`, `donors.email`, `donors.weightKg`,
`donors.bloodType`, `donors.permanentUnfitnessReason`, `donors.guardianName` e `temporary_unfitness.reason`
(eligibility); `users.email`, `users.name` e `users.pendingEmail` (auth); `notification_logs.recipient`,
`subject`, `message`, `error` e `suppressed_recipients.email` (notification). Ver seções 3.1, 4.1/4.2 e 6. A chave vem de `DATA_ENCRYPTION_KEY` (32
bytes; ver `.env.example`), lida diretamente de `process.env` porque um `ValueTransformer` é
instanciado fora do container de DI do Nest.

Formato gravado: `gcm:` + base64(iv, etiqueta, texto cifrado). Valores antigos (AES-256-CBC, sem
prefixo) continuam legíveis, mas a busca por igualdade em `bloodType` só encontra linhas já
migradas: rode **uma vez** `npm run reencrypt` em `backend/main/eligibility` (depois do build) para
regravar tudo em GCM. O script é idempotente e roda numa transação.

Duas variantes:

- **IV aleatório** (padrão): cada gravação produz um texto cifrado diferente, mesmo para o mesmo
  valor - mais seguro, mas não permite buscar/comparar por igualdade no banco. Usado em
  `weightKg`, `permanentUnfitnessReason`, `guardianName` e `reason` (nenhum é filtrado por igualdade).
- **IV determinístico** (`{ deterministic: true }`): o IV é derivado via HMAC do próprio texto
  puro, então o mesmo valor sempre produz o mesmo texto cifrado - preserva `WHERE coluna = ...`.
  Usado só em `bloodType`, porque `ListContactsUseCase` filtra doadores por tipo
  sanguíneo exato (campanhas de urgência). Trade-off aceito: um adversário com acesso ao banco
  aprende quando dois registros compartilham o mesmo valor (não o valor em si) - insuficiente para
  produção real (onde uma coluna de índice cego separada seria preferível), suficiente para o
  escopo deste TCC.

### Índice cego e JSON selado

Um valor cifrado com IV aleatório não pode ser consultado nem tornado único pelo banco. Para o CPF, o e-mail e as
palavras do nome, a coluna cifrada ganha uma coluna auxiliar com o HMAC-SHA-256 do valor normalizado
(`shared/.../crypto/blind-index.ts`), calculado com a subchave `doesangue:blind-index:v1`, derivada de
`DATA_ENCRYPTION_KEY`, e com o propósito (`cpf`, `email`, `name-word`) misturado à entrada, para que o mesmo texto
não produza o mesmo índice em colunas diferentes. A unicidade (`cpfIndex`, `emailIndex`) e a busca exata usam essas
colunas. O nome é indexado por palavra (sem acento, em minúsculas, com 2 ou mais letras), e a busca compara palavras
inteiras (`nameIndexes @> :palavras`). O índice revela quando dois registros têm o mesmo CPF, e-mail ou palavra, e
um atacante com a chave pode testar valores candidatos; sem a chave, não.

O corpo dos trabalhos da fila de notificações (BullMQ/Redis) e os avisos de conta pendentes (`account_notices.payload`)
são cifrados por inteiro (`sealJson`, formato `{ "sealed": "gcm:..." }`) no serviço de origem e abertos só no
consumidor (porta `JOB_PAYLOAD_OPENER`). Registros antigos, sem selo, ainda são lidos.

Fora desta cifragem ficam, por decisão deste protótipo, as datas de doação, os resultados das avaliações de
elegibilidade e o motivo de cancelamento. O disco, os backups e o tráfego dependem da infraestrutura, e a chave é lida
do ambiente, sem KMS nem rotação.

As migrations `1763100000000-encrypt-*` (uma por serviço) cifram os dados existentes, criam os índices e têm `down`.

### 8.2 Rate limiting no fluxo de redefinição de senha

`AuthModule` registra um `ThrottlerModule` (`@nestjs/throttler`) usado pontualmente (não como guard
global) em `POST /auth/forgot-password` (5 req/15min por IP) e `POST /auth/reset-password` (10
req/15min por IP) - ver `auth.controller.ts`. Junto com a validade reduzida do token (15min, seção
3.3), reduz a superfície de abuso do fluxo (spam de geração de token, automação de tentativas)
sem afetar login/refresh/demais rotas.

### 8.3 Log de auditoria de acesso ao perfil

Todo acesso relevante ao perfil de um doador através do `DonorsController` (visualizar, atualizar,
listar/registrar/end inaptidões, exportar, anonimizar) grava uma linha em
`audit_accesses` (seção 4.4) com quem acessou, o papel e a ação. Consultável por um admin em
`GET /donors/:id/audit`. Uma falha ao gravar auditoria é logada mas nunca propagada -
`AuditoriaService#registrar` nunca lança.

### 8.4 Portabilidade e anonimização de dados (direitos do titular)

- **Exportação** (`GET /donors/:id/export`, dono ou admin): devolve tudo que o
  `eligibility-service` guarda sobre o doador (cadastro, inaptidões, avaliações de elegibilidade)
  num único payload. O front (`ProfilePage`) complementa isso combinando também `GET /auth/me` e
  `GET /appointments/me` num único arquivo JSON baixado pelo navegador - não há endpoint de
  agregação no backend para isso; é uma composição do lado do cliente, já que os três dados são
  igualmente acessíveis pelo dono via seu próprio JWT.
- **Exclusão/anonimização** (`POST /auth/me/delete-data`, dono, só contas `donor`, com a senha
  atual no corpo e limite de 5 tentativas / 15 min - a exclusão não tem volta, então uma sessão
  esquecida aberta não basta): como não há transação distribuída entre schemas (seção 1), a operação
  é orquestrada pelo `auth-service`:
  1. pede ao `scheduling-service` (`POST /appointments/internal/donors/:id/cancel-open`, interno)
     que cancele os agendamentos em aberto e tire da fila os lembretes, que levam nome e e-mail;
  2. pede ao `eligibility-service` (`POST /donors/:id/anonymize`, interno) para descaracterizar
     nome/CPF/telefone/e-mail do `Donor` e redigir motivos em texto livre;
  3. enfileira o job `erase-personal-data`, com que o `notification-service` troca destinatário e
     texto dos e-mails já enviados ao titular (`sent_notifications`) por um marcador;
  4. anonimiza o próprio `User`, revoga refresh tokens, tokens de reset pendentes e os tokens de
     acesso já emitidos (seção 4 do docs/06). É uma
  anonimização (soft), não uma exclusão física de linha: preserva dados não identificantes
  (tipo sanguíneo, histórico de doações, avaliações de elegibilidade, agendamentos concluídos) para
  fins estatísticos/de saúde pública, sem nada que identifique a pessoa. Contas `admin` não podem
  se autoexcluir por aqui (usam o ciclo de `deactivateAdmin`, que sempre preserva pelo menos um
  admin ativo).
