import { InvalidValueError } from '../errors';

/** CPF de um novo cadastro: exatamente 11 dígitos, sem máscara (o mesmo contrato da API). */
export class Cpf {
  private constructor(readonly value: string) {}

  static parse(raw: string): Cpf {
    if (!/^\d{11}$/.test(raw)) {
      throw new InvalidValueError('O CPF deve ter exatamente 11 dígitos numéricos, sem máscara.');
    }
    return new Cpf(raw);
  }
}
