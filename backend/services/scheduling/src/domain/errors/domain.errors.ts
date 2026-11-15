// Os erros de domínio do scheduling são as duas categorias comuns: BusinessRuleError (operação
// incompatível com o estado do agregado) e InvalidValueError (valor que viola uma invariante).
export { BusinessRuleError, DomainError, InvalidValueError } from '@shared/domain/errors';
