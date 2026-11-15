import { ApplicationError } from '@shared/application/errors';

export { ApplicationError, NotFoundError } from '@shared/application/errors';

/** Algum e-mail do job não foi entregue: o worker relança para o BullMQ tentar de novo. */
export class NotificationDeliveryError extends ApplicationError {
  constructor(failed: number, total: number) {
    super(`${failed} de ${total} e-mail(s) não foram entregues; o job será tentado de novo.`);
  }
}
