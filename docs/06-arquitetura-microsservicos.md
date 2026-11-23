# 06. Arquitetura de microsserviços (monorepo)

## 1. Visão geral

Um repositório, cinco serviços independentes e um frontend. "Mono" refere-se só ao repositório:
cada serviço é construído, testado, empacotado e implantado sozinho.

| Serviço      | Responsabilidade                          | Banco             | Fala com                              |
| ------------ | ----------------------------------------- | ----------------- | ------------------------------------- |
| gateway      | proxy reverso, única porta pública        | -                 | auth, eligibility, scheduling (HTTP)  |
| auth         | usuários, login, JWT                      | `auth_db`         | eligibility (HTTP interno), fila      |
| eligibility  | doadores, regras de elegibilidade         | `eligibility_db`  | -                                     |
| scheduling   | unidades, campanhas, agendamentos, outbox | `scheduling_db`   | eligibility (HTTP), fila              |
| notification | worker de e-mails (BullMQ)                | `notification_db` | consome a fila `notifications`        |

## 2. Regras de isolamento

1. **Dados**: cada serviço tem banco e usuário próprios (`infra/postgres/init-databases.sh`); não há
   FK nem consulta entre bancos. Referências entre serviços são lógicas (ex.: `donorId`).
2. **Código**: um serviço nunca importa de outro. O que é comum fica no pacote `shared`
   (`backend/shared/src/<camada>/`), consumido pelo alias `@shared/<camada>/*` e compilado dentro do serviço.
   `pnpm run check:boundaries` falha o CI se a regra for quebrada (inclusive as regras de camadas da seção 2.1).
3. **Build**: cada serviço tem seu `package.json` e Dockerfile em `backend/services/<serviço>/`. As dependências são instaladas por um
   workspace pnpm (`backend/pnpm-workspace.yaml`) com lockfile único (`backend/pnpm-lock.yaml`); o `node_modules` de cada serviço
   contém só o que ele declarou, e a imagem Docker leva apenas as dependências de produção (`pnpm deploy --prod`). Cada serviço tem
   também seu pipeline (`.github/workflows/<serviço>.yml`, disparado só quando o pacote do serviço ou o `shared` mudam).
   O `.github/workflows/backend-quality.yml` cobre o backend inteiro: lint, `check:boundaries` e os testes de
   integração contra um Postgres real. Cada serviço compila só o próprio `src/` e o que ele importa do `shared`
   (o `tsconfig` não inclui o `shared` inteiro), por isso declara apenas as dependências que de fato usa.
4. **Comunicação**: HTTP síncrono entre serviços usando a chave interna
   (`x-internal-api-key`) e propagação de `x-request-id`; assíncrona pela fila BullMQ.

### 2.1 Organização por camadas (Clean Architecture)

Cada serviço é um pacote em `backend/services/<serviço>/`, com o código em `src/` (todos os testes ficam em `backend/tests/`); o código comum fica em
`backend/shared/` (mesma estrutura). Dentro de `src/` há as quatro camadas e as dependências só apontam para dentro.

```
backend/
  services/
    <serviço>/                        gateway  auth  eligibility  scheduling  notification
      src/
        domain/  application/  infrastructure/  presentation/
        main.ts  app.module.ts  (+ módulos de composição)
      package.json  Dockerfile  tsconfig.json  tsconfig.build.json  jest.config.js  nest-cli.json
  shared/
    src/   domain/ application/ infrastructure/ presentation/ bootstrap/ contracts.ts
  tests/
    unit/<pacote>/          espelha src/ (tests/unit/<pacote>/<camada>/...)
    integration/<pacote>/   repositórios contra Postgres real (pnpm run test:integration)
    support/<pacote>/       fakes, builders e fixtures (test-database em support/shared)
    e2e/                    fluxo completo, cada serviço em um processo
  scripts/
```

| Camada         | Pasta (dentro de `src/`) | Responsabilidade                                                                 | Pode importar                                                     |
| -------------- | ------------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Domain         | `domain/`                | Entidades, regras e erros de negócio, sem framework                              | só `@shared/domain/*`                                             |
| Application    | `application/`           | Casos de uso, portas (interfaces com tokens de injeção), DTOs de entrada/saída (`Input`/`Output`), templates e erros de aplicação | domain e `shared`; nenhum pacote externo nem `@nestjs/*` |
| Infrastructure | `infrastructure/`        | Repositórios TypeORM (entidades ORM + mappers), Redis, HTTP externo, e-mail, jobs, segurança, logs, middleware de log de acesso | domain e application |
| Presentation   | `presentation/`          | Controllers, DTOs de API (classes com `class-validator`, que `implements` os `Input` do application), guards, filters, presenters, processors de fila | domain (só enums e errors) e application, nunca infrastructure |
| Composição     | raiz de `src/`           | `main.ts`, `app.module.ts` e módulos que ligam portas a adaptadores              | qualquer camada do próprio pacote e `shared`                       |

- `backend/services/<serviço>/` guarda o código e o projeto de build do serviço (`package.json`, Dockerfile, tsconfig, jest), o que mantém cada microsserviço isolado.
- Um pacote de serviço só importa dele mesmo e de `shared` (nenhum import relativo cruza a fronteira do pacote); `shared` nunca importa de um serviço.
- Os modelos de domínio são classes puras; as entidades do ORM (`*.orm-entity.ts`) ficam em
  `src/infrastructure/persistence` do serviço e são convertidas por mappers.
- Os contratos entre camadas são tipos simples: o application define `Input`/`Output` (`shared/src/application/dto`) e a
  presentation os implementa nos DTOs de API; assim nenhuma camada interna conhece classes de validação ou Swagger.
- O pacote `shared` guarda só o que mais de um serviço usa: `shared/src/domain` (enums que trafegam entre serviços, como
  `Role`, `BloodType` e `NotificationJobType`), `shared/src/application/messaging` (fila e payloads) e `shared/src/application/dto`
  (contratos das chamadas entre serviços), `shared/src/presentation` (auth, http, health), `shared/src/infrastructure` (config,
  persistence, messaging com a conexão, a fila e as opções padrão dos jobs, observability e `http` com o `InternalHttpClient` genérico) e `shared/src/bootstrap` + `shared/src/contracts.ts` (`bootstrap` e `HealthModule`). Aliases:
  `@shared/contracts`, `@shared/bootstrap` e `@shared/<camada>/*`. Os testes dessas partes rodam no pacote `shared`.
- O barrel `@shared/contracts` reexporta enums, DTOs e mensagens e é só para a raiz de composição (`src/*.ts`), os testes e o `tests/e2e/`; as demais camadas importam
  direto da camada de origem (por exemplo, `@shared/domain/enums`).
- O `HealthController` (presentation) depende da porta `RedisHealthCheck`; o `HealthModule` em `shared/src/bootstrap`
  liga essa porta ao `RedisHealthIndicator` (infrastructure).
- O gateway é um proxy fino: tabela de rotas (`proxy-routes.ts`, que lê variáveis de ambiente) e montagem dos proxies ficam
  em `services/gateway/src/infrastructure/proxy`; o gateway não tem domínio nem casos de uso.
- O domain não usa nenhum módulo do Node (como `crypto`) nem pacote externo: o `check:boundaries` rejeita qualquer import
  fora de `@shared/domain/*`. No application só são permitidos `@shared/domain/*` e `@shared/application/*`: nem o
  `@nestjs/common` entra. Cada classe do application declara as dependências num `static readonly inject = [...]` (tokens
  das portas ou classes, na ordem do construtor) e os módulos de composição (raiz de `src/`) as registram com `provide`/`provideAll`
  (`@shared/bootstrap`), que montam a factory do Nest a partir desse array.
- Os controllers são finos: chamam casos de uso e montam a resposta com presenters. A autorização "dono ou admin"
  (`requireOwnerOrAdmin`, em `shared/src/application/auth`) é aplicada dentro dos casos de uso, com o `AccessDeniedError`
  compartilhado (403 na presentation). A identidade que os casos de uso recebem é o `Actor` (`shared/src/application/auth`);
  o `JwtPayload` é só o nome das claims do JWT na presentation. A regra "toda leitura ou
  alteração do perfil de um doador é auditada" fica no application, em `AuditedDonorOperations`
  (`services/eligibility/src/application/use-cases`), que executa o caso de uso e registra a auditoria; o `DonorsController` só o chama.
- Os ports genéricos `Clock` e `LoggerPort` ficam em `shared/src/application/ports`, com os adaptadores `SystemClock` e `NestLoggerAdapter` em
  `shared/src/infrastructure`; ports com contrato próprio de cada serviço (repositórios, `EligibilityGateway`, `NotificationPublisher`) ficam no
  pacote do serviço que os consome. Os casos de uso expõem sempre `execute()`.
- Scheduling e eligibility respondem por presenters (`src/presentation/http/presenters`): a API nunca serializa a entidade de domínio direto.
  Os presenters leem os tipos de saída do application (`src/application/dto`: `CampaignOutput`, `DonorRecord` etc., somente leitura) e
  produzem tipos de resposta **próprios da presentation** (`DonorResponse`, `AssessmentResponse`, `UnfitnessResponse`, `AuditResponse`,
  `DataExportResponse`, `AppointmentResponse`...), com datas já em ISO. Todos os endpoints desses dois serviços passam por um presenter, e
  `presenters.spec.ts` fixa os campos de cada resposta: mudar o domínio ou o application não altera a API sem alterar esses testes.
- As entidades de scheduling (`Appointment`, `Campaign`, `CollectionUnit`) têm campos `readonly`; o estado só muda pelos métodos de domínio.
- `NotificationJobType` fica no domínio porque é o tipo de notificação gravado no `NotificationLog`; o mesmo valor nomeia o job na fila.
- Os casos de uso devolvem DTOs de saída (`src/application/dto`), copiados das entidades por mappers (`toCampaignOutput`,
  `toDonorRecord` etc.): a entidade de domínio nunca sai do application. O `check:boundaries` impõe que a presentation só importe
  enums e erros do domínio.
- Todas as entidades têm campos `readonly` e mudam apenas por métodos de domínio (via um `mutate` privado).
- O cadastro de doador é uma saga com resultado resolvível (roll-forward ou desfazer, mais reconciliação periódica); ver
  `02-diagramas-sequencia.md`, seção 1. Repetir o cadastro com o `User` ainda pendente
  (mesmo e-mail e senha) retoma a saga em vez de responder "e-mail já cadastrado". A exclusão de conta (`DeleteMyAccount`) anonimiza
  primeiro o doador no eligibility (idempotente) e depois, **numa única transação** (`UnitOfWork` do auth), o `User` e os tokens: ou a parte
  local se completa inteira, ou nada muda e o pedido pode ser repetido.
- Os repositórios TypeORM têm testes de integração (`tests/integration/`, `pnpm run test:integration`): cada suíte cria um
  banco descartável e aplica as migrations de produção, validando também as migrations. Ficam fora do `test:all`, que roda sem banco.
- Exceções conscientes: os jobs de `services/scheduling/src/infrastructure/jobs` chamam casos de uso (são drivers agendados, como um controller) e o
  transformer de cifra de coluna lê `DATA_ENCRYPTION_KEY` direto de `process.env`.
- O gateway não repassa as rotas internas (serviço a serviço, como `POST /donors` e `/eligibility/internal/*`): respondem 404 na porta pública.
- O `check:boundaries` aplica a regra de dependência em todos os pacotes (serviços e `shared`) e ignora a raiz de composição
  (`src/*.ts`) e os testes (`tests/`); o código de produção (`src/`) nunca importa de `tests/`.
- Identidade das entidades: no eligibility e no scheduling o id nasce no banco (`gen_random_uuid()`) e o repositório
  devolve a entidade completa a partir de um rascunho (`NewDonor`, `NewAppointment`). O auth é a exceção consciente: gera os
  ids na aplicação (porta `IdGenerator`), porque o cadastro de doador precisa do id do usuário antes de gravá-lo para criar o
  doador no eligibility (saga com compensação), e os tokens de sessão nascem completos no domínio.
- Erros: as categorias comuns ficam no `shared` (`DomainError`, `BusinessRuleError`, `InvalidValueError`, `NotFoundError`,
  `ConflictError`, `AccessDeniedError`, `DependencyUnavailableError`), e um único `BusinessErrorsFilter` as traduz em HTTP.
  Cada serviço reexporta as comuns no próprio `errors` e registra só o status dos seus erros específicos
  (`presentation/http/error-status.ts`).

### 2.2 Convenções de nomes

| O quê | Padrão | Exemplo |
|---|---|---|
| Caso de uso | `<verbo>-<coisa>.use-case.ts`, classe `<Verbo><Coisa>UseCase`, método `execute` | `create-appointment.use-case.ts` |
| Serviço de aplicação (usado por casos de uso, nunca pela borda) | `application/services/` | `AuditTrail`, `EmailNotifier`, `SessionIssuer` |
| Porta | `<papel>.repository.ts`, `.gateway.ts` ou `.publisher.ts`; as demais, `<nome>.port.ts` | `user.repository.ts`, `clock.port.ts` |
| Adaptador TypeORM | arquivo `<entidade>.typeorm-repository.ts`, classe `<Entidade>TypeOrmRepository` | `DonorTypeOrmRepository` |
| Entrada e saída dos casos de uso | `*Input` e `*Output` em `application/dto` | `RegisterTemporaryUnfitnessInput`, `DonorOutput` |
| Representação HTTP | presenters `to<Coisa>Response` em `presentation/http/presenters` | `toUserResponse` |
| Busca que falha com 404 | helper `load<Coisa>OrFail` em `use-cases/shared` | `loadAppointmentOrFail` |

Os `*Output` de `shared/src/application/dto` são os **contratos** entre serviços (formato que trafega no HTTP, com datas em
texto); os de cada serviço são o resultado interno dos casos de uso. O eligibility não importa os do `shared`.

### 2.3 Decisão: o `shared` é compartilhado como código-fonte

**Contexto.** Os serviços precisam de código comum: contratos entre serviços (enums, DTOs, payloads da fila), bootstrap do
Nest, guards de autenticação, `/health`, logs, configuração e o cliente HTTP interno. É preciso decidir como esse código chega a
cada serviço sem acoplar um serviço a outro.

**Decisão.** O `shared` é distribuído como **código-fonte**, não como biblioteca instalada:

- o serviço importa pelo alias `@shared/<camada>/...`, que o `tsconfig.json` e o `jest.config.js` apontam para `backend/shared/src`;
- o `nest build` do serviço compila, junto com o próprio código, só os arquivos do `shared` que ele importa
  (o `tsconfig` inclui apenas o `src/` do serviço e segue os imports); o resultado fica em `dist/shared/` dentro do `dist` do serviço;
- as bibliotecas que esses arquivos usam vêm do `node_modules` do **serviço**, no build e em produção. Por isso cada serviço
  declara no próprio `package.json` as bibliotecas do código do `shared` que ele usa;
- o pacote `backend/shared` (com `package.json`, `tsconfig.json` e `node_modules` próprios) existe só para rodar os testes e o
  typecheck do próprio `shared`; nenhum serviço o instala.

**Consequências.**

- (+) Sem etapa de build intermediária: cada serviço compila e é implantado sozinho, e o Docker leva só o `dist` e as
  dependências de produção do serviço.
- (+) Cada serviço carrega só a parte do `shared` que usa (o gateway compila 19 arquivos do `shared`, não todos).
- (−) Mudar um arquivo do `shared` exige recompilar e reimplantar os serviços que o usam (os pipelines dos serviços já disparam
  quando o `shared` muda).
- (−) As bibliotecas do `shared` aparecem em dois lugares (o `package.json` do `shared` e o de cada serviço), e nem o pnpm nem o
  TypeScript avisam quando essas listas divergem. O `check:deps` (`backend/scripts/check-deps.mjs`, no CI) fecha essa lacuna:
  percorre o grafo de imports de cada pacote (incluindo os arquivos do `shared` alcançados) e falha se faltar ou sobrar
  biblioteca no `package.json`.
- (−) A dependência dos serviços em relação ao `shared` não aparece no `package.json`; ela é garantida pelos aliases e pelas regras
  do `check:boundaries` (um serviço só importa de si mesmo e do `shared`, nunca por caminho relativo).

**Alternativas consideradas.**

1. **`shared` como pacote do workspace** (`"@doesangue/shared": "workspace:*"`, compilado para o próprio `dist`, com `exports` e
   bibliotecas como `peerDependencies`). Torna a dependência explícita e validada pelo pnpm, mas exige compilar o `shared` antes
   dos serviços, trocar a resolução de módulos do TypeScript para `node16` e manter um build em modo watch no desenvolvimento.
   Como `typeorm` e `bullmq` teriam de ser dependências opcionais (o gateway não as usa), a validação continuaria incompleta.
2. **Vários pacotes menores** (`contracts` sem dependências, `platform`, `persistence`, `messaging`). Cada serviço dependeria só do
   que usa, e o gateway deixaria de levar `typeorm` na imagem. É o arranjo mais coerente com microsserviços, mas acrescenta quatro
   builds e quatro manifestos a um sistema de cinco serviços.

A opção atual com o `check:deps` resolve o problema prático (dependências fora de sincronia) com a menor mudança; as alternativas
ficam registradas como evolução em [Limites conhecidos](#6-limites-conhecidos).

## 3. Confiabilidade

- **Outbox transacional** (scheduling): `CompleteAppointmentUseCase` grava o status `COMPLETED` e o evento
  `DONATION_COMPLETED` na mesma transação. O despachante reserva um lote num único comando
  (`UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED) RETURNING`, que adia o vencimento dos
  eventos por 2 min) e só então, sem transação aberta, atualiza o doador, reavalia a elegibilidade
  (endpoint interno, origem `POST_DONATION`) e enfileira o aviso; se a instância cair, o lote volta
  quando a reserva vence. Falhas reagendam com backoff exponencial (até 8 tentativas, depois `FAILURE`). Entrega
  *at-least-once*, por isso o handler é idempotente: `completeDonation` recebe a `donationDate` do
  evento, só avança `lastDonationAt` (nunca recua) e o aviso usa o jobId `intervalo-<appointment>`,
  então repetições não geram segundo e-mail.
- **Reconciliação** (a cada 10 min, também via `POST /outbox/reconcile`): recria o evento de
  conclusões (últimos 30 dias, posteriores ao primeiro evento do outbox) que ficaram sem evento e
  reativa eventos em `FAILURE` após 1 h de espera, até 3 vezes. Passando disso o evento fica em `FAILURE`
  e cada ciclo registra um log `ALERTA`; um admin vê `GET /outbox/failures` e devolve o evento à fila
  com `POST /outbox/:id/reprocess` depois de corrigir a causa.
- **Retry nos jobs** (BullMQ): 10 tentativas com backoff exponencial a partir de 30 s (cerca de 4 h no total), 5 jobs ao mesmo tempo. Cada envio grava `SENT` ou `FAILURE`;
  se algum falhar, o worker relança e o BullMQ tenta de novo, mas só reenvia a quem ainda não recebeu
  naquele job (`EmailNotifier` consulta o log), então campanhas não geram e-mail duplicado.
- **Concorrência otimista** nos agendamentos: coluna `version`, e o repositório grava com
  `UPDATE ... WHERE id = ? AND version = ?`. Duas transições simultâneas (ex.: cancelar e fazer check-in)
  não se sobrescrevem: a segunda recebe 409. O doador (eligibility) tem a mesma proteção: o repositório
  trava a linha, confere a versão lida e grava, então o perfil editado pelo doador não desfaz a data da
  última doação gravada ao mesmo tempo pela pós-doação (que, recebendo 409, é repetida pelo outbox). A confirmação de presença continua idempotente: se duas confirmações chegam
  juntas (duplo clique no link), a segunda vê que o agendamento já está confirmado e responde sucesso.
- **Aviso de campanha urgente**: a campanha e o evento `URGENT_CAMPAIGN_CREATED` são gravados na mesma transação; o
  despachante do outbox avisa só os doadores aptos a doar hoje que aceitam avisos (o eligibility aplica o motor de
  elegibilidade), com um job por doador (jobId `campaign-<campanha>-<doador>`) para que repetições não gerem aviso
  duplicado e o limite de envios por segundo valha por e-mail.
- **E-mails enviados**. Todos passam pela fila `notifications` e saem do notification-service, em HTML e texto,
  no ritmo de `MAIL_RATE_PER_SECOND` (padrão 5 por segundo):

  | E-mail | Quem enfileira | Quando |
  |---|---|---|
  | Agendamento confirmado, pedido de confirmação e lembrete | scheduling, pelo outbox (`APPOINTMENT_CONFIRMED`, na transação do resultado da avaliação) | confirmação na hora; pedido 48 h antes; lembrete 24 h antes |
  | Pedido de confirmação de presença | scheduling | 48 h antes (na hora, se faltar menos) |
  | Lembrete | scheduling | 24 h antes, com o link de confirmação enquanto o doador não confirmar |
  | Agendamento cancelado | scheduling, pelo outbox (`APPOINTMENT_CANCELED`, na transação do cancelamento) | cancelamento pelo doador, pela equipe ou pela desativação da unidade (não na exclusão da conta) |
  | Obrigado por doar | scheduling, pelo outbox (`DONATION_COMPLETED`) | ao concluir a doação |
  | Você já pode doar | eligibility, rotina diária às 8h de Brasília | quem ontem estava inapto com data prometida para hoje e hoje está apto, com o e-mail confirmado e sem agendamento em aberto |
  | Campanha urgente | scheduling, pelo outbox | ao criar a campanha |
  | Aviso de falta | scheduling, pelo outbox (`APPOINTMENT_NO_SHOW`) | quando o admin marca o não comparecimento |
  | Boas-vindas (com o link de confirmação do e-mail) | auth, pelo outbox `auth.account_notices` (na transação que conclui o cadastro, inclusive quando a reconciliação conclui um cadastro de resultado incerto) | ao concluir o cadastro de doador |
  | Confirme seu e-mail / Confirme seu novo e-mail | auth, pelo outbox `auth.account_notices` | no reenvio do link (aviso no topo das telas do doador) e na troca de e-mail em Meu perfil, para o endereço novo |
  | Redefinição de senha | auth | no "esqueci a senha" |
  | Senha alterada | auth, pelo outbox `auth.account_notices` (na transação da troca) | depois da redefinição |
  | E-mail alterado | auth, pelo outbox `auth.account_notices` (na transação da troca) | quando o link enviado ao endereço novo é aberto, para o endereço antigo (o novo aparece mascarado) |

  Campanha e "já pode doar" só vão para quem aceita avisos (`receiveAlerts`, em Meu perfil); os demais são resposta a
  algo que o doador fez e sempre saem. O "já pode doar" é decidido com os dados do dia (motor de elegibilidade), e não
  com uma data calculada na doação: quem recebeu uma inaptidão, doou de novo ou excluiu a conta não é avisado. Em
  desenvolvimento, o docker-compose envia tudo para o Mailpit (http://localhost:8025); para envio real, basta
  configurar `SMTP_*` com um provedor (ver `.env.example`).
- **Nenhum aviso se perde com a fila fora do ar**: os avisos ligados a uma mudança de estado são gravados num outbox
  na mesma transação da mudança e entregues à fila depois, com novas tentativas - no scheduling, a tabela de outbox
  que já existia; no auth, `auth.account_notices` (despachada a cada 5 s, com espera crescente até 15 min; o
  registro é apagado ao ser entregue e, se não for entregue em 24 h, descartado com log `ALERT`). O despachante do
  agendamento confirmado confere o agendamento antes de enfileirar: cancelado ou com horário passado, não agenda nada.
  A exceção é a redefinição de senha: o link leva o token, que o auth não grava em texto puro, e quem pediu está
  esperando o e-mail e pode pedir de novo.
- **Persistência do Redis**: os lembretes ficam na fila como jobs agendados para semanas depois; o Redis do
  docker-compose grava em disco (AOF, volume `redis-data`), então recriar o container não os apaga.
- **Devoluções e spam**: o webhook `POST /notifications/webhooks/mail?token=MAIL_WEBHOOK_SECRET` recebe os eventos do
  provedor (formato do Brevo: `event`, `email`); `hard_bounce`, `invalid_email`, `blocked` e `spam` bloqueiam o
  endereço (`notification.suppressed_recipients`). Um endereço bloqueado não recebe mais nada: o envio fica no
  registro como `SUPPRESSED`, sem nova tentativa. Sem o segredo configurado, o webhook não existe (404).
- **Sair da lista com um clique**: campanha e "já pode doar" levam no rodapé um link assinado (`/unsubscribe?token=`,
  com botão de confirmar) e o cabeçalho `List-Unsubscribe` + `List-Unsubscribe-Post` (RFC 8058), que o Gmail e o
  Outlook mostram como botão e que chama `POST /donors/alerts/unsubscribe` direto. O token (HMAC derivado do
  `JWT_SECRET`, gerado no notification-service e conferido no eligibility-service) só desliga `receiveAlerts`.
- **Confirmação do endereço de e-mail**: o cadastro de doador nasce com o e-mail não confirmado
  (`auth.users.emailVerifiedAt` nulo; espelhado em `eligibility.donors.emailVerified`) e as boas-vindas levam o link
  `/verify-email?token=`, válido por 48 h. O token é um HMAC (chave derivada do `JWT_SECRET` com rótulo próprio) com o
  usuário, o e-mail e a validade, sem nada gravado: um link de um e-mail que já não é o da conta, nem o pendente, deixa
  de valer. Até confirmar, o doador entra no sistema mas não agenda (o JWT leva `emailVerified` e o scheduling recusa;
  o admin pode agendar por ele) nem recebe campanha e "já pode doar". Na troca de e-mail em Meu perfil, o endereço novo
  fica em `pendingEmail` e o login continua com o atual até o link enviado ao novo ser aberto; aí o auth atualiza o
  doador no eligibility, conclui a troca e avisa o endereço antigo. A página só confirma no clique (um antivírus que
  "visita" o link não confirma pela pessoa) e, se o navegador tem sessão, renova o token. Os usuários existentes antes
  dessa regra foram marcados como confirmados na migração; admins nascem confirmados.
- **"Já pode doar" e agendamentos**: antes de enfileirar, o eligibility pergunta ao scheduling
  (`POST /appointments/internal/donors-with-open-appointment`) quais candidatos já têm agendamento em aberto e pula
  esses; se o scheduling não responder, a rotina falha e tenta de novo no próximo ciclo (a cada 15 min), sem enviar
  nada pela metade.
- **Limite de requisições nas rotas públicas dos e-mails**: o descadastro (`POST /donors/alerts/unsubscribe`) aceita
  20 requisições / 15 min por IP e o webhook do provedor, 300 / min (`@nestjs/throttler`, com `trust proxy` para
  ler o IP real repassado pelo gateway).
- **Acompanhamento pelo admin**: o notification-service passa a ser alcançável pelo gateway (prefixo `/notifications`)
  só para a tela "E-mails" do painel (JWT de admin): registro de envios (e-mails mascarados), falhas definitivas com
  botão de reenviar e endereços bloqueados com botão de desbloquear. O notification-service precisa do `JWT_SECRET`.
- **Envio**: 10 tentativas por e-mail, 5 jobs ao mesmo tempo, `MAIL_RATE_PER_SECOND` por segundo; nenhum token de link
  vai para o registro de envios. Ao subir, o serviço confere a conexão SMTP e avisa no log, em produção, se os
  e-mails estiverem indo para o Mailpit ou simulados.
- **Operação dos e-mails**: no cancelamento, o evento do outbox também tira da fila o lembrete e o pedido de
  confirmação (com nova tentativa se a fila falhar), então um agendamento cancelado não recebe lembrete. Um job que
  esgota as 10 tentativas gera um log `ALERT` no notification-service (o motivo de cada e-mail fica em
  `sent_notifications`). O registro de envios guarda 180 dias e é limpo a cada 6 h.
- **Datas de negócio no fuso de Brasília** (`shared/src/domain/time`): "hoje", o dia de um agendamento, a
  data da doação e a idade do doador são calculados em `America/Sao_Paulo`, independentemente do fuso do
  servidor; instantes continuam em UTC.
- **Sessão**: a rotação do refresh token é atômica (só uma requisição concorrente vence), e reapresentar um
  token revogado há mais de 10 s (tolerância para várias abas) revoga todas as sessões do usuário. A
  redefinição de senha consome o token, troca a senha e revoga as sessões numa única transação.

## 4. Segurança

- **Login**: limite de 10 tentativas / 15 min por IP (o gateway repassa o IP real via
  `X-Forwarded-For` e o auth-service usa `trust proxy`) e bloqueio por conta (5 falhas seguidas =
  15 min, resposta 429). A comparação de senha roda mesmo com e-mail inexistente, para o tempo de
  resposta não revelar contas. Um atacante pode bloquear temporariamente a conta de outra pessoa
  (troca-se disponibilidade por proteção contra força bruta); redefinir a senha libera a conta.
- **CORS**: o gateway só aceita as origens de `CORS_ORIGINS` (padrão: `FRONTEND_URL`).
- **Cabeçalhos HTTP**: `helmet` em todos os serviços (a CSP é relaxada só em `/docs`, por causa do Swagger UI).
- **Refresh token**: cookie `doesangue_rt` (`httpOnly`, `Path=/auth`, `SameSite=Strict` por padrão,
  `Secure` em produção) - o JavaScript do front nunca o lê. O access token (15 min) fica só em memória.
  `/auth/refresh` e `/auth/logout` rejeitam `Origin` fora da lista do CORS (defesa extra contra CSRF).
  Se front e API ficarem em sites diferentes, use `COOKIE_SAMESITE=none` (exige HTTPS).
- **Primeiro admin**: exige `ADMIN_SETUP_TOKEN` (header `x-setup-token`); sem a variável, o bootstrap fica fechado.
- **Chave interna**: `x-internal-api-key` é comparada em tempo constante (`timingSafeEqual`), e as rotas internas nem chegam ao serviço pela porta
  pública (o gateway responde 404 a elas).
- **JWT**: assinado e validado só com HS256 (o algoritmo é fixado nos dois lados).
- **Revogação do token de acesso**: desativar um admin, excluir a conta, trocar a senha ou detectar o reuso de um refresh
  token grava no Redis o instante da revogação do usuário; o `JwtStrategy` de todos os serviços recusa tokens emitidos antes
  dele. Assim o acesso acaba na hora, não só quando o token de 15 min expira. Se o Redis estiver fora do ar, a checagem deixa
  passar (com aviso no log) e o token vale até expirar, como antes.
- **E-mail de login**: gravado em minúsculas e comparado sem diferenciar maiúsculas.
- **Senhas**: no máximo 72 bytes (o bcrypt ignoraria o resto). Pedir de novo a redefinição invalida os links anteriores, e o
  log de e-mails enviados guarda o link de redefinição sem o token.
- **`x-request-id`**: um valor recebido fora do formato (até 128 caracteres de letras, dígitos, `.`, `_`, `:` e `-`) é
  trocado por um novo antes de ir para os logs e para as chamadas internas.
- **Busca de doadores**: por CPF completo (índice cego) ou por palavras inteiras do nome; não há `ILIKE` sobre dados pessoais, que ficam cifrados.
- **Criptografia de colunas**: AES-256-GCM (ver docs/01, seção 8). Na cifra determinística (tipo sanguíneo), o IV vem de
  uma subchave derivada da chave principal, e não da própria chave (a mesma chave não serve ao HMAC e ao AES); a migration
  `1762100000000-reencrypt-blood-type` regravou os valores do formato anterior.
- **Swagger**: `/docs` fica desligado com `NODE_ENV=production`; `SWAGGER_ENABLED=true|false` força o valor em qualquer ambiente.
- **Segredos em produção**: com `NODE_ENV=production`, a validação de ambiente recusa segredos de exemplo, curtos ou uma
  `DATA_ENCRYPTION_KEY` fora do formato de 32 bytes (`shared/src/infrastructure/config/production-secrets.ts`). O
  docker-compose local liga `ALLOW_INSECURE_DEFAULT_SECRETS=true` só para a demonstração subir sem configuração.
- **Portas no docker-compose**: só o gateway (3000) e o frontend (5173) ficam expostos na rede; os serviços internos, o
  Postgres e o Redis ficam ligados a `127.0.0.1`, então rotas internas e o `X-Forwarded-For` não podem ser alcançados ou
  forjados de fora da máquina.
- **Unicidade**: e-mail (auth) e CPF/usuário (eligibility) são garantidos pelo índice único do banco; os repositórios
  traduzem a violação (`23505`) em 409, então dois cadastros simultâneos não resultam em erro 500.
- **Datas de entrada**: campos que são só data usam `@IsCalendarDate()` (exige AAAA-MM-DD e uma data que exista).

## 5. Frontend

O front é uma SPA única que conversa apenas com o gateway (`VITE_API_URL`). Seu código é organizado
por funcionalidade espelhando os serviços: `features/auth` (auth-service), `features/eligibility`
(eligibility-service), `features/scheduling` e `features/campaigns` (scheduling-service). As telas
administrativas ficam na feature dona de cada API, e uma feature só usa outra pelo seu `index.ts`.

## 6. Limites conhecidos

- Os DTOs de contrato ainda são **código compartilhado** (`backend/shared/src/contracts.ts` e o pacote `shared`), não contratos
  versionados e publicados; mudar um contrato exige rebuild dos serviços afetados. Evoluções possíveis (ver seção 2.3): separar o
  `shared` em pacotes do workspace (começando por um `contracts` sem dependências) e, depois, trocar o código compartilhado por
  contratos formais (OpenAPI ou JSON Schema) validados nos dois lados.
- O `@nestjs/terminus` declara `typeorm` como dependência peer opcional; como outros serviços do workspace têm `typeorm`, o pnpm
  resolve uma única cópia do terminus com ele, e a imagem do gateway acaba levando `typeorm` e `pg` sem usá-los (o código do
  gateway não os carrega). Só a separação em pacotes resolveria isso.
- Migrations: aplicadas automaticamente em todo ambiente. Alterações de schema exigem gerar uma nova migration manualmente; os
  testes de integração (no CI) comparam o schema criado pelas migrations com as entidades e falham se houver divergência.
- Não há tracing distribuído nem broker próprio de eventos (a fila Redis cobre só notificações).
- As listagens administrativas de agendamentos (`GET /appointments`) não são paginadas. Paginar exige mudar o formato da
  resposta (`{ items, total }`) e a tela correspondente do frontend; com o volume de um hemocentro isso não é gargalo hoje.
