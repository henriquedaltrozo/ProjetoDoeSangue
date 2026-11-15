# front - Sistema de Agendamento de Doação de Sangue

SPA em React + TypeScript (Vite) que consome o backend (`../backend`) exclusivamente através do
gateway. Estrutura por feature:

```
src/
  app/              # casca da aplicação: layout, guarda de rotas, error boundary (podem conhecer as features)
  features/         # um módulo por domínio, espelhando os serviços do backend
    auth/           # login, cadastro de doador, senha, admin inicial e gestão de admins
    scheduling/     # agendamentos (doador e admin) e unidades de coleta
    eligibility/    # perfil, situação para doar, LGPD, busca de doadores, avaliações e inaptidões (admin)
    campaigns/      # campanhas (visão do doador e gestão pelo admin)
      <feature>/index.ts      # API pública: o que outras features e app/ podem importar
      <feature>/api/          # chamadas HTTP (axios) - sem React
      <feature>/hooks/        # TanStack Query: queries, mutations e invalidação
      <feature>/components/   # componentes usados só por esta feature
      <feature>/lib/          # regras de apresentação da feature (ex.: scheduling/lib/attendance.ts)
      <feature>/pages/        # telas: usam os hooks da própria feature
      <feature>/schemas.ts    # validação dos formulários (zod)
  shared/
    api/            # cliente axios (interceptors de JWT/refresh), chaves de cache (QUERY_KEYS)
    session/        # sessão do usuário (zustand) e tela inicial de cada papel
    ui/             # componentes reutilizáveis sem regra de negócio (Button, ButtonLink, Card, Field...)
    types/          # api.ts (tipos espelhando os DTOs do backend) e labels.ts (rótulos de tela)
    lib/            # utilitários (datas, CPF, máscaras de CPF/telefone, download, debounce)
  test/             # setup do Vitest
e2e/                # testes end-to-end (Playwright)
```

As telas do admin ficam na feature dona do domínio (ex.: `scheduling/pages/AdminUnitsPage.tsx`), não
numa feature "admin" à parte.

Regras de dependência: `shared` não importa de `features` nem de `app`. Dentro de uma feature, os
imports são diretos (`@/features/scheduling/hooks/...`); entre features, só pelo `index.ts`
(`import { useUnits } from '@/features/scheduling'`). As páginas falam com o servidor só por hooks
(nunca `useQuery`/`useMutation` direto na página, nem `api` direto); um hook pode compor a API
pública de outra feature quando o caso exige (ex.: a exportação LGPD junta auth, eligibility e
scheduling). As páginas carregam sob demanda (`lazy`), e um `ErrorBoundary` por rota evita tela em
branco em erros de renderização sem derrubar o menu. Toda query exibida numa tela mostra um aviso
quando falha.

As regras de dependência entre camadas e features são verificadas pelo lint (`noRestrictedImports`
em `biome.json`): um import proibido quebra o `npm run lint` e o CI.

## Stack

- React 19 + TypeScript, Vite
- Tailwind CSS v4
- React Router (rotas protegidas por papel: doador/admin)
- TanStack Query (cache/estado de servidor)
- Zustand (sessão do usuário, persistida em localStorage)
- react-hook-form + zod (formulários e validação)
- Vitest + Testing Library (testes unitários) e Playwright (e2e)

## Rodando localmente

Pré-requisito: o backend rodando (localmente via `npm run start:*` em `../backend`, ou via
`docker compose up` na raiz do repositório) - por padrão o front espera o gateway em
`http://localhost:3000` (ver `.env.example`).

```bash
npm install
cp .env.example .env   # ajuste VITE_API_URL se o gateway não estiver em localhost:3000
npm run dev             # http://localhost:5173
```

Outros comandos:

```bash
npm run build     # build de produção em dist/
npm run lint       # biome check (lint, formatação, ordem dos imports e regras de dependência)
npm run format     # aplica a formatação e organiza os imports
npm run preview    # serve o build de produção localmente
```

## Testes

### Unitários (Vitest + Testing Library)

Cobrem os schemas de validação (zod) - incluindo casos-limite de coerção/campos opcionais que já
pegaram bugs reais (ver comentários em `features/*/schemas.ts`) -, a store de sessão (zustand), o
helper de extração de mensagem de erro da API e alguns componentes/rotas compartilhados.

```bash
npm run test         # roda uma vez (CI)
npm run test:watch    # modo watch
```

No CI (`.github/workflows/frontend.yml`), cada push ou PR que mexe em `frontend/` roda o lint, o
build (que inclui a checagem de tipos) e os testes unitários.

### End-to-end (Playwright)

Um único fluxo sequencial num navegador real, contra o build de produção do front
(`vite preview`) e o backend já rodando: bootstrap do primeiro admin, cadastro de unidade e
campanha, cadastro de um doador e confirmação do e-mail pelo link, visualização da campanha,
edição de perfil, agendamento e cancelamento, troca de e-mail (com o link no endereço novo),
redefinição de senha pelo link, campanha urgente com descadastro pelo link, tela E-mails do admin,
check-in/conclusão do agendamento, busca do doador e registro de inaptidão, e
desativação/reativação de unidade e campanha. Os e-mails são lidos no Mailpit
(`e2e/support/mailpit.ts`, `MAILPIT_URL`, padrão `http://127.0.0.1:8025`) e o fluxo confere que
cada um chegou. Também falha se aparecer qualquer erro no console
do navegador durante o fluxo (foi assim que um bug real de logout - 401 por limpar o token antes
da requisição sair - foi encontrado durante o desenvolvimento).

Pré-requisitos: backend rodando e acessível em `VITE_API_URL`, enviando os e-mails para o
Mailpit, e o Chromium do Playwright instalado (`npx playwright install chromium`, uma vez; ou
aponte `PLAYWRIGHT_CHROMIUM_PATH` para um Chrome/Edge já instalado). Como o bootstrap do primeiro
admin só funciona uma vez por banco "zerado" (ver `backend/README.md`), rode contra um banco limpo.

O jeito mais simples é a stack descartável de `docker-compose.e2e.yml` (na raiz): projeto e
volumes próprios, que não tocam no banco do dia a dia, e e-mails sempre no Mailpit, mesmo que o
`.env` aponte para um SMTP real:

```bash
docker compose stop   # na raiz: a stack normal usa as mesmas portas
docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d --build --wait
cd frontend
E2E_BASE_URL=http://localhost:5173 E2E_SETUP_TOKEN=e2e-setup-token npm run e2e
cd .. && docker compose -f docker-compose.yml -f docker-compose.e2e.yml down -v   # apaga só os dados do e2e
docker compose up -d
```

Com `E2E_BASE_URL`, o teste usa o front já no ar; sem ela, faz `npm run build` antes e o
`playwright.config.ts` sobe o `vite preview` (porta 4173).

## Docker

A imagem (`Dockerfile`) faz build do SPA e serve os arquivos estáticos via nginx (com fallback
de SPA para o react-router). `VITE_API_URL` é embutido no bundle em build time (limitação do
Vite: variáveis `VITE_*` só existem em build time, não em runtime) - ver `docker-compose.yml`
na raiz do repositório, serviço `front`.

A configuração do nginx fica em `nginx/`:

- `default.conf.template`: cache de 1 ano para os arquivos com hash em `/assets/`, `index.html`
  sem cache (cada deploy chega na hora), compressão gzip e a Content-Security-Policy. O endereço
  do gateway entra na CSP (`connect-src`) pela variável `API_ORIGIN`, que o Dockerfile preenche
  com o mesmo `VITE_API_URL` do build.
- `security-headers.conf`: CSP, `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy: no-referrer` (a tela de redefinição de senha leva o token na URL) e
  `Permissions-Policy`.
