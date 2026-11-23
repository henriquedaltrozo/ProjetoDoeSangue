# DoeSangue — Sistema de Agendamento de Doação de Sangue

TCC: **DoeSangue**, sistema de agendamento de doação de sangue. É um **monorepo de microsserviços**: cada serviço
NestJS é um projeto isolado (próprio `package.json`, build, testes, Dockerfile e banco de dados; as
dependências são instaladas por um workspace **pnpm** com lockfile único, mas cada serviço só enxerga o que declarou), todos atrás de um gateway único, com um frontend React que só conversa com o gateway.

```
backend/
  services/                       # um pacote por serviço (próprio package.json, Dockerfile, tsconfig, jest)
    auth/                         # usuários, login, JWT              -> auth_db
    eligibility/                  # doadores e elegibilidade          -> eligibility_db
    scheduling/                   # unidades, campanhas, agendamentos -> scheduling_db (+ outbox)
    notification/                 # worker BullMQ de e-mails          -> notification_db
    gateway/                      # reverse proxy - única porta exposta ao frontend
      src/                        # todo o código do serviço
        domain/                   #   entidades, regras e erros de negócio (sem framework nem módulos do Node)
        application/              #   casos de uso, portas, DTOs de entrada/saída e erros de aplicação
        infrastructure/           #   TypeORM (entidades ORM + repositórios + mappers), Redis, HTTP, e-mail, jobs
        presentation/             #   controllers, DTOs de API, guards, filters, presenters, processors de fila
        main.ts, app.module.ts    #   composição do serviço (e módulos que ligam portas a adaptadores)
  shared/                         # código comum aos serviços (mesma estrutura de src/)
    src/                          #   domain/ application/ infrastructure/ presentation/ + bootstrap/ e contracts.ts
  tests/                          # todos os testes, por tipo e, dentro de cada tipo, por pacote (auth, eligibility, ..., shared)
    unit/<pacote>/                #   espelha src/ (ex.: tests/unit/scheduling/domain/appointment/appointment.spec.ts)
    integration/<pacote>/         #   repositórios contra um Postgres real (pnpm run test:integration)
    support/<pacote>/             #   fakes, builders e fixtures (test-database em support/shared)
    e2e/                          # teste de fluxo completo: cada serviço em um processo, um banco por serviço
  scripts/                        # check-boundaries (as demais tarefas são scripts do pnpm)
  pnpm-workspace.yaml             # workspace pnpm: services/*, shared e tests/e2e (lockfile único em pnpm-lock.yaml)
frontend/                         # SPA React (consome só o gateway)
infra/postgres/                   # cria um banco e um usuário por serviço
.github/workflows                 # um pipeline por serviço (com filtro de paths) + shared, front, e2e e qualidade
docs/                             # modelagem, sequência, contratos, observabilidade e arquitetura (06)
```

Cada serviço é um pacote isolado: `services/<serviço>/src` guarda as quatro camadas da Clean Architecture. Todos os testes ficam em
`tests/`, separados por tipo (`unit`, `integration`, `e2e`) e, dentro de cada tipo, por pacote (ex.: `tests/unit/auth`), com os apoios
(fakes, builders) em `tests/support/<pacote>`. O código comum fica em `shared/src` (aliases `@shared/<camada>/*`). Nos testes,
`@src/*` aponta para o `src/` do pacote, `@test/support/*` para `tests/support/<pacote>` e `@shared/testing/*` para os apoios do shared. As dependências só apontam para dentro e o `pnpm run check:boundaries` verifica. Os modelos de domínio são
separados das entidades do ORM, com mappers entre eles. Os controllers só validam acesso e chamam casos de uso; a orquestração com
auditoria fica na camada de aplicação (`AuditedDonorOperations`). O pnpm instala tudo uma única vez (store global com links), e o
`node_modules` de cada serviço contém apenas as dependências que ele declarou. Nas imagens Docker, `pnpm deploy --prod`
gera um `node_modules` só com as dependências de produção do serviço.

Arquitetura e decisões: `docs/06-arquitetura-microsservicos.md`.

## Subindo tudo com Docker Compose

```bash
docker compose up --build
```

| Serviço                         | URL                        |
| ------------------------------- | -------------------------- |
| Frontend                        | http://localhost:5173      |
| Gateway (API)                   | http://localhost:3000      |
| auth-service (Swagger)          | http://localhost:3001/docs |
| eligibility-service (Swagger)   | http://localhost:3002/docs |
| scheduling-service (Swagger)    | http://localhost:3003/docs |
| notification-service (health)   | http://localhost:3004/health |
| PostgreSQL / Redis              | localhost:5432 / 6379      |

O Postgres cria, na primeira subida do volume, um banco e um usuário por serviço
(`infra/postgres/init-databases.sh`). Se você já tinha um volume antigo, rode
`docker compose down -v` antes (isso apaga os dados locais).

O projeto do Compose se chama `doesangue` (campo `name` do `docker-compose.yml`), então os containers
são `doesangue-postgres-1`, `doesangue-auth-service-1` etc. Quem subiu o projeto quando ele ainda se
chamava `projetotcc` precisa remover os containers antigos uma vez, porque eles ocupam as mesmas
portas. Sem `-v`, o banco é preservado: o volume `projetotcc_postgres-data` continua em uso.

```bash
docker compose -p projetotcc down
```

## Rodando localmente sem Docker

Requer Node 20+, pnpm 10+ (`corepack enable`; a versão exata vem do campo `packageManager`), PostgreSQL 16+ e Redis.

```bash
cp .env.example .env            # ajuste segredos antes de produção
(cd backend && pnpm install)   # instala o workspace inteiro (use --frozen-lockfile no CI)
cd backend/services/auth && pnpm run start   # idem para eligibility, scheduling, notification e gateway
cd frontend && npm install && npm run dev
```

Em desenvolvimento um único banco serve para todos (`DB_*`); para isolar, defina
`AUTH_DB_*`, `ELIGIBILITY_DB_*`, `SCHEDULING_DB_*` e `NOTIFICATION_DB_*` (ver `.env.example`).

## Segurança: primeiro admin e variáveis

O primeiro admin só pode ser criado com o token de instalação: defina `ADMIN_SETUP_TOKEN` no auth-service e
informe-o na tela `/setup-admin` (ou no header `x-setup-token` de `POST /auth/admin`). Sem a variável o
cadastro fica fechado. Outras variáveis: `CORS_ORIGINS` (origens do front), `COOKIE_SECURE`/`COOKIE_SAMESITE`
(cookie do refresh token). Detalhes em `docs/06-arquitetura-microsservicos.md`.

Ao atualizar um banco que já tem dados cifrados, rode uma vez a migração para AES-256-GCM:
`cd backend/services/eligibility && pnpm run build && pnpm run reencrypt   # script em backend/services/eligibility/src/infrastructure/scripts`.

## Qualidade e testes

```bash
cd backend
pnpm install                # instala o workspace (inclui o Biome, na raiz de backend/)
pnpm run lint               # Biome em services, shared e tests
pnpm run check:boundaries   # pacotes isolados, regra de dependência e domain/application sem módulos do Node
pnpm run test:all           # typecheck + jest do shared e dos 5 serviços (só unitários)
pnpm run test:integration   # repositórios TypeORM contra um Postgres real (precisa de Postgres no ar)

# e2e (Postgres e Redis no ar; build de cada serviço feito antes com `pnpm run build`)
cd tests/e2e && pnpm exec jest --runInBand
```

O front tem `npm run lint`, `npm test` (vitest) e `npm run e2e` (playwright, ver `frontend/README.md`).

## Confirmação de presença e pós-doação

O doador recebe e-mail 48h e 24h antes com um link para confirmar presença. O scheduling-service
precisa de `FRONTEND_URL` para montar o link. Ao concluir uma doação, o scheduling grava o status e um
evento no **outbox** na mesma transação; um despachante atualiza o doador, reavalia a elegibilidade e
enfileira o aviso, com nova tentativa e backoff em caso de falha. Uma reconciliação periódica recria eventos
perdidos e reativa os que falharam; eventos que esgotam as tentativas geram um log `ALERTA` e aparecem para
o admin em `GET /outbox/failures` (reprocessar: `POST /outbox/:id/reprocess`).

## Swagger em produção

O Swagger (`/docs`) só sobe fora de produção. Com `NODE_ENV=production` ele fica desligado; para ligar (ou
desligar) explicitamente em qualquer ambiente, defina `SWAGGER_ENABLED=true` (ou `false`).

## Migrations

Em qualquer ambiente, cada serviço aplica sozinho, ao subir, as migrations de
`backend/services/<serviço>/src/infrastructure/persistence/migrations` (`migrationsRun`): o banco de desenvolvimento é igual
ao de produção. O schema Postgres precisa existir antes (o `infra/postgres/init-databases.sh` já o cria). Para mudar uma
entidade, gere uma nova migration para aquele serviço e inclua-a no `index.ts` da pasta; os testes de integração comparam as
migrations com as entidades e falham se alguma mudança ficou sem migration. `DB_SYNCHRONIZE=true` troca as migrations pelo
`synchronize` do TypeORM, só para experimentar uma mudança localmente. Um banco que já foi criado por `synchronize` precisa
ter a migration inicial marcada como aplicada (insira o registro em `<schema>.migrations`) ou ser recriado.
