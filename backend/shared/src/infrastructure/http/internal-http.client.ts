import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { RequestContextService } from '../observability';
import { RemoteCallError } from './remote-call.error';

/**
 * Em nome de quem a chamada é feita:
 * - `'service'`: o próprio serviço, autenticado pela `x-internal-api-key` (ver InternalApiKeyGuard);
 * - `'user'`: o usuário da requisição HTTP em andamento, repassando o header `Authorization` dele
 *   (guardado no RequestContextService) para que o serviço chamado aplique as próprias regras de
 *   acesso. Só funciona dentro de uma requisição autenticada.
 */
export type InternalCaller = 'service' | 'user';

export interface InternalRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** URL absoluta (cada adaptador monta a sua a partir da variável de ambiente do serviço chamado). */
  url: string;
  data?: unknown;
  params?: Record<string, string>;
  as: InternalCaller;
}

/**
 * Cliente HTTP genérico para chamadas entre serviços. Só cuida do que é comum a todas elas:
 * credencial, propagação do `x-request-id` e conversão da falha em RemoteCallError. As rotas, os
 * tipos e a tradução de erros ficam no adaptador de cada serviço que consome outro.
 */
@Injectable()
export class InternalHttpClient {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly requestContext: RequestContextService,
  ) {}

  async send<T>(request: InternalRequest): Promise<T> {
    const { method, url, data, params } = request;
    // Fora do try: falta de credencial é erro de programação, não falha do serviço remoto.
    const headers = this.headersFor(request.as);
    try {
      const response = await firstValueFrom(
        this.http.request<T>({ method, url, data, params, headers }),
      );
      return response.data;
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string | string[] }>;
      const remote = axiosErr.response?.data?.message;
      throw new RemoteCallError(
        `${method} ${url}`,
        axiosErr.response?.status,
        Array.isArray(remote) ? remote.join('; ') : remote,
        axiosErr.message,
      );
    }
  }

  private headersFor(caller: InternalCaller): Record<string, string> {
    const headers: Record<string, string> =
      caller === 'service'
        ? { 'x-internal-api-key': this.config.getOrThrow<string>('INTERNAL_API_KEY') }
        : { Authorization: this.userAuthorization() };
    const requestId = this.requestContext.getRequestId();
    if (requestId) headers['x-request-id'] = requestId;
    return headers;
  }

  private userAuthorization(): string {
    const authorization = this.requestContext.getAuthorization();
    if (!authorization) {
      throw new Error(
        'Chamada interna em nome do usuário fora de uma requisição autenticada (sem header Authorization).',
      );
    }
    return authorization;
  }
}
