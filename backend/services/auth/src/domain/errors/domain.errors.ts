import { BusinessRuleError } from '@shared/domain/errors';

export { BusinessRuleError, DomainError, InvalidValueError } from '@shared/domain/errors';

/** Um admin não pode desativar a própria conta (evita se auto-bloquear). */
export class SelfDeactivationNotAllowedError extends BusinessRuleError {
  constructor() {
    super('Você não pode desativar sua própria conta de admin.');
  }
}

/** Não pode haver um sistema sem nenhum admin ativo. */
export class LastAdminActiveError extends BusinessRuleError {
  constructor() {
    super('Não é possível desativar o único admin ativo.');
  }
}

/** Contas admin têm ciclo próprio de desativação: autoexclusão (LGPD) é só para doadores. */
export class AdminAccountNotDeletableError extends BusinessRuleError {
  constructor() {
    super(
      'Contas de admin não podem ser excluídas por aqui - peça a outro admin para desativar a sua.',
    );
  }
}
