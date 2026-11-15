# syntax=docker/dockerfile:1
# Serviço scheduling. Contexto de build = raiz do backend (precisa dos pacotes, do tsconfig.base.json e do
# lockfile do workspace pnpm):
#   docker build -f services/scheduling/Dockerfile .
# O workspace é instalado com o lockfile único (pnpm-lock.yaml), mas só as dependências deste serviço
# (services/scheduling/package.json). A imagem final leva apenas as dependências de produção (pnpm deploy --prod).

FROM node:20-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# Manifestos do workspace: camada de cache que só muda quando as dependências mudam.
FROM base AS manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tests/e2e/package.json ./tests/e2e/
COPY shared/package.json ./shared/
COPY services/gateway/package.json ./services/gateway/
COPY services/auth/package.json ./services/auth/
COPY services/eligibility/package.json ./services/eligibility/
COPY services/scheduling/package.json ./services/scheduling/
COPY services/notification/package.json ./services/notification/

# Todas as dependências do serviço (inclui as de build) para compilar.
FROM manifests AS deps
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @doesangue/scheduling-service --filter .

# Somente dependências de produção, em /prod/node_modules.
FROM manifests AS prod-deps
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @doesangue/scheduling-service deploy --prod /prod

FROM deps AS build
COPY tsconfig.base.json ./
COPY shared ./shared
COPY services/scheduling ./services/scheduling
WORKDIR /app/services/scheduling
RUN pnpm exec nest build

FROM node:20-alpine AS runtime
WORKDIR /app/services/scheduling
ENV NODE_ENV=production
COPY --from=prod-deps /prod/node_modules ./node_modules
COPY --from=build /app/services/scheduling/dist ./dist
USER node
CMD ["node", "dist/services/scheduling/src/main.js"]
