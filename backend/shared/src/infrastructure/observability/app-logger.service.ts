import { ConsoleLogger } from '@nestjs/common';
import { RequestContextService } from './request-context.service';

/**
 * Logger estruturado: cada chamada emite exatamente uma linha JSON no
 * stdout, sempre com `timestamp`, `level`, `service` e (quando a chamada
 * acontece dentro de uma requisição HTTP) `requestId` - o correlation id
 * lido do RequestContextService. Isso é o que faz o `x-request-id` valer a
 * pena: dá pra filtrar/juntar logs de vários serviços de uma mesma
 * requisição só grepando o id (`grep '"requestId":"<id>"' *.log`).
 *
 * Registrar uma vez por serviço, em main.ts, com
 * `app.useLogger(new AppLogger('nome-do-servico'))`. A partir daí, o Nest
 * delega estaticamente: toda instância `new Logger(contexto)` já espalhada
 * pelo código (adaptadores, jobs, filtros etc.) passa a emitir
 * nesse formato automaticamente, sem precisar tocar em cada ponto de uso.
 *
 * `message` pode ser uma string simples ou um objeto - nesse caso, seus
 * campos são espalhados no JSON em vez de virarem a propriedade `message`
 * (é o que o middleware de access log usa para incluir method/path/status).
 */
export class AppLogger extends ConsoleLogger {
  constructor(private readonly serviceName: string) {
    super();
  }

  log(message: unknown, ...optionalParams: unknown[]) {
    this.write('log', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]) {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]) {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]) {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]) {
    this.write('verbose', message, optionalParams);
  }

  private write(level: string, message: unknown, optionalParams: unknown[]) {
    // Convenção do próprio Nest (ConsoleLogger): em log/warn/debug/verbose o
    // último parâmetro extra é o `context`; em error, costuma vir
    // `(stack, context)`. Não vale a pena distinguir com precisão aqui -
    // guardamos tudo que sobrar em `detail`, sempre visível no JSON.
    const context =
      optionalParams.length > 0 ? String(optionalParams[optionalParams.length - 1]) : undefined;
    const detail = optionalParams.length > 1 ? optionalParams.slice(0, -1) : undefined;

    const base: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      requestId: new RequestContextService().getRequestId(),
      context,
    };
    if (detail) {
      base.detail = detail;
    }

    const payload =
      typeof message === 'object' && message !== null
        ? { ...base, ...(message as Record<string, unknown>) }
        : { ...base, message };

    // eslint-disable-next-line no-console
    const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    sink(JSON.stringify(payload));
  }
}
