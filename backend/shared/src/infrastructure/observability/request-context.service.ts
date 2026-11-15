import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';

interface RequestContextStore {
  requestId: string;
  /** Header `Authorization` da requisição, para repassá-lo em chamadas a outros serviços em nome do usuário. */
  authorization?: string;
}

/**
 * Propaga o correlation id (`x-request-id`) para qualquer profundidade de
 * chamada dentro do processo (services, repositories, o AppLogger) sem
 * precisar passá-lo como parâmetro em cada função, nem tornar a subárvore
 * de DI inteira request-scoped (custo de performance do escopo REQUEST do
 * Nest, que recriaria providers a cada requisição).
 *
 * A store é armazenada numa AsyncLocalStorage **estática** de propósito:
 * quem popula o contexto (`createRequestLoggingMiddleware`, em
 * request-logging.middleware.ts) roda como middleware Express puro, fora
 * do container de DI do Nest, então não pode receber esta classe injetada -
 * precisa poder fazer `new RequestContextService()` e já enxergar a mesma
 * store que o resto da aplicação usa via injeção normal.
 */
@Injectable()
export class RequestContextService {
  private static readonly storage = new AsyncLocalStorage<RequestContextStore>();

  /** Executa `callback` com `requestId` disponível para toda a árvore de chamadas assíncronas iniciada dentro dele. */
  run<T>(requestId: string, callback: () => T, options: { authorization?: string } = {}): T {
    return RequestContextService.storage.run({ requestId, ...options }, callback);
  }

  /** Lê o requestId da requisição em andamento, ou `undefined` se chamado fora de um `run()` (ex: fora de um request HTTP). */
  getRequestId(): string | undefined {
    return RequestContextService.storage.getStore()?.requestId;
  }

  /** Header `Authorization` da requisição em andamento, ou `undefined` se não houver. */
  getAuthorization(): string | undefined {
    return RequestContextService.storage.getStore()?.authorization;
  }
}
