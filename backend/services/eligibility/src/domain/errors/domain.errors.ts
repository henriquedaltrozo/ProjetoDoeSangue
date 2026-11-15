import { BusinessRuleError, InvalidValueError } from '@shared/domain/errors';

export { BusinessRuleError, DomainError, InvalidValueError } from '@shared/domain/errors';

export class DonationDateInFutureError extends InvalidValueError {
  constructor() {
    super('A data da doação não pode estar no futuro.');
  }
}

export class UnfitnessAlreadyEndedError extends BusinessRuleError {
  constructor() {
    super('Este período de inaptidão já foi encerrado.');
  }
}
