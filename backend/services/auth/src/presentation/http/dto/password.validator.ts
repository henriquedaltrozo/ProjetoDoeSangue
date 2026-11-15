import { ValidateBy, type ValidationOptions } from 'class-validator';

/** O bcrypt só considera os primeiros 72 bytes da senha: o resto seria ignorado sem aviso. */
export const MAX_PASSWORD_BYTES = 72;

/** Senha nova: no máximo 72 bytes em UTF-8 (acentos e emojis ocupam mais de um byte). */
export function MaxPasswordBytes(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'maxPasswordBytes',
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= MAX_PASSWORD_BYTES,
        defaultMessage: () =>
          `A senha pode ter no máximo ${MAX_PASSWORD_BYTES} bytes (cerca de ${MAX_PASSWORD_BYTES} caracteres sem acento).`,
      },
    },
    options,
  );
}
