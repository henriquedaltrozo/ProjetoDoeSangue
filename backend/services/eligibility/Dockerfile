# syntax=docker/dockerfile:1
# Serviço eligibility. Contexto de build = raiz do backend (precisa dos pacotes, do tsconfig.base.json e do
# lockfile do workspace pnpm):
#   docker build -f services/eligibility/Dockerfile .
# O workspace é instalado com o lockfile único (pnpm-lock.yaml), mas só as dependências deste serviço
# (services/eligibility/package.json). A imagem final leva apenas as dependências de produção (pnpm deploy --prod).

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
    pnpm install --frozen-lockfile --filter @doesangue/eligibility-service --filter .

# Somente dependências de produção, em /prod/node_modules.
FROM manifests AS prod-deps
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @doesangue/eligibility-service deploy --prod /prod

FROM deps AS build
COPY tsconfig.base.json ./
COPY shared ./shared
COPY services/eligibility ./services/eligibility
WORKDIR /app/services/eligibility
RUN pnpm exec nest build

FROM node:20-alpine AS runtime
WORKDIR /app/services/eligibility
ENV NODE_ENV=production
COPY --from=prod-deps /prod/node_modules ./node_modules
COPY --from=build /app/services/eligibility/dist ./dist
USER node
CMD ["node", "dist/services/eligibility/src/main.js"]
