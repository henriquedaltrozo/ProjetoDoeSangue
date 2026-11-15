/**
 * Falha numa chamada HTTP a outro serviço interno. É neutra de propósito (não é uma HttpException
 * do Nest): cada serviço decide, no seu adaptador, em que erro da aplicação ela se transforma.
 */
export class RemoteCallError extends Error {
  constructor(
    /** Ex.: "POST http://eligibility:3002/donors". */
    readonly call: string,
    /** Status HTTP da resposta; `undefined` quando não houve resposta (timeout, conexão recusada). */
    readonly status: number | undefined,
    /** Campo `message` do corpo de erro do serviço remoto, se houver. */
    readonly remoteMessage: string | undefined,
    /** Descrição técnica da falha (mensagem do axios), para log. */
    readonly reason: string,
  ) {
    super(`${call} falhou${status ? ` com status ${status}` : ''}: ${reason}`);
    this.name = 'RemoteCallError';
  }
}
