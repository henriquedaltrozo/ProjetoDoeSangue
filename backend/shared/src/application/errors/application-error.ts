/** Base dos erros lançados pelos casos de uso; a camada HTTP os traduz em status e mensagem. */
export abstract class ApplicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

// Erros comuns a todos os serviços. Os específicos de um serviço (ex.: muitas tentativas de login)
// ficam no application/errors do próprio serviço, que também reexporta estes.

/** O recurso pedido não existe. */
export class NotFoundError extends ApplicationError {}

/** A operação conflita com o estado atual (ex.: e-mail ou CPF já cadastrado). */
export class ConflictError extends ApplicationError {}

/** O ator autenticado não pode executar a operação sobre este recurso. */
export class AccessDeniedError extends ApplicationError {}

/** Entrada inválida que só a aplicação consegue detectar (ex.: link malformado, dado obrigatório para a idade). */
export class InvalidEntryError extends ApplicationError {}

/** Um serviço externo necessário à operação falhou ou está indisponível. */
export class DependencyUnavailableError extends ApplicationError {}
