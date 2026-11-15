import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ResetPasswordDto } from '@src/presentation/http/dto/reset-password.dto';

describe('MaxPasswordBytes', () => {
  const errorsFor = (newPassword: string) =>
    validateSync(plainToInstance(ResetPasswordDto, { token: 't', newPassword }));

  it('aceita senha de até 72 bytes', () => {
    expect(errorsFor('a'.repeat(72))).toHaveLength(0);
  });

  it('recusa senha acima de 72 bytes, contando acentos como mais de um byte', () => {
    expect(errorsFor('a'.repeat(73))).toHaveLength(1);
    // 40 "ç" = 80 bytes em UTF-8, embora sejam só 40 caracteres.
    expect(errorsFor('ç'.repeat(40))).toHaveLength(1);
  });
});
