import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { AppLogger } from './app-logger.service';
import { RequestContextService } from './request-context.service';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Formato aceito para um `x-request-id` vindo de fora: curto e sem caracteres de controle. O valor
 * vai para os logs e para as chamadas a outros serviços; um id fora disso é trocado por um novo.
 */
const VALID_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

/**
 * Middleware Express **puro** (não um Interceptor do Nest) de propósito -
 * assim dá pra montar exatamente da mesma forma em qualquer main.ts,
 * inclusive no gateway. O gateway é um reverse proxy puro
 * (http-proxy-middleware montado via `app.use()`, ver gateway/main.ts) e
 * seu tráfego de negócio nunca passa pelo pipeline de Interceptors do Nest
 * - só a rota /health dele passaria. Um Interceptor não resolveria o
 * problema ali; middleware Express montado antes do proxy, sim.
 *
 * Montar com `app.use(createRequestLoggingMiddleware('nome-do-servico'))`
 * bem no início de main.ts, antes de qualquer outra rota/middleware
 * (no gateway, antes de montar o proxy).
 *
 * Responsabilidades:
 * 1. Lê `x-request-id` do header de entrada - permite o gateway propagar o
 *    id recebido do front-end, ou um teste/cliente fornecer um id próprio -
 *    ou gera um novo (`randomUUID`) quando ausente ou fora do formato (até 128 caracteres de
 *    letras, dígitos, `.`, `_`, `:` e `-`).
 * 2. Devolve o id no header de resposta.
 * 3. Roda o restante do pipeline dentro do AsyncLocalStorage
 *    (RequestContextService), para que qualquer log emitido durante essa
 *    requisição - neste serviço, e em qualquer serviço chamado via HTTP
 *    interno que também receba o header propagado - inclua o mesmo id. O
 *    header `Authorization` também fica no contexto: o InternalHttpClient o
 *    repassa nas chamadas feitas em nome do usuário, sem que os casos de uso
 *    precisem conhecer a credencial.
 * 4. Loga um evento estruturado por requisição ao final (`res.on('finish')`):
 *    método, rota (sem a query string, que pode ter dado pessoal), status e duração - é o "logging de toda
 *    request/response" citado no pedido original, sem precisar de um
 *    interceptor global do Nest (que não cobriria o proxy do gateway).
 */
export function createRequestLoggingMiddleware(serviceName: string): RequestHandler {
  const logger = new AppLogger(serviceName);
  const context = new RequestContextService();

  return function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
    const header = req.headers[REQUEST_ID_HEADER];
    const incomingId = Array.isArray(header) ? header[0] : header;
    const requestId = incomingId && VALID_REQUEST_ID.test(incomingId) ? incomingId : randomUUID();
    req.headers[REQUEST_ID_HEADER] = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    const startedAt = process.hrtime.bigint();
    const { authorization } = req.headers;
    context.run(
      requestId,
      () => {
        res.on('finish', () => {
          const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
          logger.log({
            message: 'http_request',
            method: req.method,
            // Sem a query string: ela pode trazer dado pessoal (ex.: busca de doador por CPF).
            path: req.originalUrl.split('?')[0],
            statusCode: res.statusCode,
            durationMs: Math.round(durationMs * 100) / 100,
          });
        });
        next();
      },
      { authorization },
    );
  };
}
