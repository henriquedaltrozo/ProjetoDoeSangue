import { InvalidValueError } from '../errors';

/** E-mail de contato: um endereço no formato usuario@dominio.tld, sem espaços. */
export class Email {
  private constructor(readonly value: string) {}

  static parse(raw: string): Email {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
      throw new InvalidValueError('E-mail inválido.');
    }
    return new Email(raw);
  }
}
