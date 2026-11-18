# 05. Observabilidade

Este documento descreve os três pilares de observabilidade implementados no backend: correlation
id entre serviços, health checks reais e logging estruturado. Os três vivem juntos numa lib
compartilhada, `backend/shared/src/infrastructure/observability`, importada por todos os 5 serviços.

## 1. Correlation id (`x-request-id`)

Problema que resolve: numa requisição que atravessa gateway → scheduling-service →
eligibility-service, cada serviço logava isoladamente - não havia nada que amarrasse as três
entradas de log como sendo "a mesma requisição", tornando debugar um fluxo distribuído lento.

Implementação: `createRequestLoggingMiddleware(nomeDoServico)`
(`backend/shared/src/infrastructure/observability/request-logging.middleware.ts`) é um middleware **Express puro** (não um
Interceptor do Nest), montado via `app.use(...)` logo no início de cada `main.ts` - inclusive no
gateway, **antes** do loop que monta o reverse proxy. Ele:

1. Lê `x-request-id` do header de entrada, ou gera um novo (`randomUUID()`) quando ausente.
2. Devolve o id no header de resposta.
3. Roda o resto do pipeline dentro de uma `AsyncLocalStorage` (`RequestContextService`), para que
   qualquer log emitido durante essa requisição - neste serviço, e em qualquer serviço chamado via
   HTTP interno que também receba o header propagado - inclua o mesmo id.
4. Loga um evento estruturado por requisição, no fim (`res.on('finish')`): método, rota, status,
   duração.

Ser middleware Express puro (em vez de um `Interceptor` do Nest) é uma escolha deliberada: o
gateway é um reverse proxy puro (`http-proxy-middleware` montado via `app.use()` em
`gateway/main.ts`, com `bodyParser: false`) e seu tráfego de negócio nunca passa pelo pipeline de
Interceptors do Nest - só a rota `/health` do próprio gateway passaria. Um middleware Express,
montado antes do proxy, cobre os dois casos com o mesmo código.

O cliente HTTP interno compartilhado (`InternalHttpClient`, em `backend/shared/src/infrastructure/http/`),
usado pelos adaptadores de auth e scheduling que chamam o eligibility-service, lê o id atual via
`RequestContextService#getRequestId()` e o repassa no header `x-request-id` de toda chamada
serviço-a-serviço, fechando a cadeia de propagação.

Para investigar um fluxo específico: pegue o `x-request-id` devolvido na resposta (ou logado pelo
front, se for guardado) e grep nos logs de todos os serviços:

```bash
grep '"requestId":"<id>"' /caminho/para/*.log
```

## 2. Health checks reais

Antes, todo `/health` respondia sempre `{status: 'ok', ...}` - um placeholder que não checava
nada. Agora, cada serviço usa `@nestjs/terminus` para checar de verdade suas dependências:

| Serviço | O que `/health` checa |
| --------- | ------------------------ |
| auth-service | Postgres (`TypeOrmHealthIndicator`) |
| eligibility-service | Postgres (`TypeOrmHealthIndicator`) |
| scheduling-service | Postgres + Redis (`RedisHealthIndicator`, indicador próprio - ver abaixo) |
| notification-service | Postgres + Redis (mesmo indicador) |
| gateway | Agrega o `/health` dos três serviços acima via `HttpHealthIndicator.pingCheck(...)` (o gateway não tem banco/cache próprios) |

Qualquer indicador que falhe faz o `@HealthCheck()` do terminus responder `503` automaticamente,
com o corpo detalhando qual dependência caiu - é isso que permite usar
`condition: service_healthy` no `docker-compose.yml` (antes, só `postgres`/`redis` tinham esse
tipo de condição; `scheduling-service`, por exemplo, só esperava o eligibility-service "ter
iniciado", não "estar pronto"; `gateway` esperava os três só terem iniciado).

`@nestjs/terminus` não tem indicador oficial para Redis (só Postgres/Mongo/etc). `RedisHealthIndicator`
(`backend/shared/src/infrastructure/observability/redis-health.indicator.ts`) é um indicador próprio: abre uma conexão curta e
dedicada, faz `PING`, e sempre desconecta - mesmo padrão defensivo já usado pelo
`RedisCacheService` do scheduling-service (conexão lazy, sem retry indefinido).

`notification-service` era, até esta mudança, um worker BullMQ puro, bootstrapado via
`NestFactory.createApplicationContext` (só o container de DI, sem servidor HTTP) - por isso não
tinha `/health`. Agora sobe um HTTP mínimo (`NestFactory.create` + `app.listen`) só para expor essa
rota, na porta `NOTIFICATION_SERVICE_PORT` (padrão `3004`); continua sem nenhuma rota de negócio e
sem ser alcançável pelo gateway.

## 3. Logging estruturado

`AppLogger` (`backend/shared/src/infrastructure/observability/app-logger.service.ts`) estende o `ConsoleLogger` do Nest e
emite uma linha JSON por evento, sempre com `timestamp`, `level`, `service` e (dentro de uma
requisição) `requestId`:

```json
{"timestamp":"2026-09-11T02:33:25.212Z","level":"log","service":"scheduling-service","requestId":"corr-teste-123","message":"http_request","method":"POST","path":"/appointments/","statusCode":201,"durationMs":84.65}
```

Registrado uma vez por serviço, em `main.ts`, com `app.useLogger(new AppLogger('name-do-servico'))`
(chamado com `bufferLogs: true` no `NestFactory.create`, para não perder os logs do próprio
bootstrap do Nest, emitidos antes desse `useLogger`). A partir daí, o Nest delega estaticamente:
toda instância `new Logger(contexto)` já espalhada pelo código (use cases, repositórios e adaptadores) passa a emitir nesse formato automaticamente, sem precisar tocar em
cada ponto de uso - inclusive os próprios logs internos do Nest (`RoutesResolver`,
`InstanceLoader`, ...).

O log de acesso por requisição (item 1, passo 4) é o "logar automaticamente todo request/response"
pedido originalmente - implementado no middleware Express em vez de um Interceptor global do Nest
pelo mesmo motivo do item 1: um Interceptor não cobriria o tráfego proxied do gateway.

## Verificação manual (smoke test)

Com a stack no ar (Docker Compose ou os 5 serviços localmente):

```bash
# Health checks reais - cada um checa suas próprias dependências
curl http://localhost:3000/health   # gateway (agregado)
curl http://localhost:3001/health   # auth-service
curl http://localhost:3002/health   # eligibility-service
curl http://localhost:3003/health   # scheduling-service
curl http://localhost:3004/health   # notification-service

# Correlation id: gera um novo (ou envie o seu) e confira nos logs de
# gateway, scheduling-service e eligibility-service que o mesmo id aparece
# em todas as entradas dessa requisição
curl -H "x-request-id: meu-id-de-teste" -H "Authorization: Bearer <token>" \
  -X POST http://localhost:3000/appointments -d '...'
```

Derrubar o Postgres (`service postgresql stop`) com os serviços no ar faz `/health` de
auth/eligibility/scheduling/notification responder `503` imediatamente, e o `/health` agregado do
gateway refletir a queda dos três que dependem dele - validado durante a implementação deste
recurso.
