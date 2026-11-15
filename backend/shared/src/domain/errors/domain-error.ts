/** Base dos erros de regra de negócio lançados pelo domínio (sem qualquer noção de HTTP). */
export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Operação incompatível com o estado atual (ex.: transição de status inválida, último admin ativo). */
export class BusinessRuleError extends DomainError {}

/** Valor que viola uma invariante do modelo (ex.: data no passado, CPF malformado). */
export class InvalidValueError extends DomainError {}
