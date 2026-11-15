import { InvalidValueError } from '@src/domain/errors';
import { Cpf, Email } from '@src/domain/value-objects';

describe('Cpf', () => {
  it('aceita 11 dígitos', () => {
    expect(Cpf.parse('12345678901').value).toBe('12345678901');
  });

  it.each(['123.456.789-01', '1234567890', '123456789012', 'abcdefghijk', ''])(
    'rejeita %p',
    (raw) => {
      expect(() => Cpf.parse(raw)).toThrow(InvalidValueError);
    },
  );
});

describe('Email', () => {
  it('aceita um endereço válido', () => {
    expect(Email.parse('maria@example.com').value).toBe('maria@example.com');
  });

  it.each(['maria', 'maria@', '@example.com', 'maria@example', 'ma ria@example.com'])(
    'rejeita %p',
    (raw) => {
      expect(() => Email.parse(raw)).toThrow(InvalidValueError);
    },
  );
});
