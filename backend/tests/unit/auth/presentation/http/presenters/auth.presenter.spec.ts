import { Role } from '@shared/domain/enums';
import {
  toForgotPasswordResponse,
  toUserResponse,
} from '@src/presentation/http/presenters/auth.presenter';

describe('auth presenters', () => {
  it('toUserResponse copia só os campos públicos do usuário', () => {
    const output = {
      id: 'u1',
      email: 'a@b.com',
      name: 'Ana',
      role: Role.DONOR,
      donorId: 'd1',
      active: true,
      emailVerified: true,
      pendingEmail: null,
      extra: 'não deve sair',
    };
    expect(toUserResponse(output)).toEqual({
      id: 'u1',
      email: 'a@b.com',
      name: 'Ana',
      role: Role.DONOR,
      donorId: 'd1',
      active: true,
      emailVerified: true,
      pendingEmail: null,
    });
  });

  it('toForgotPasswordResponse só inclui o token quando o application o devolveu', () => {
    expect(toForgotPasswordResponse({ message: 'ok' })).toEqual({ message: 'ok' });
    expect(toForgotPasswordResponse({ message: 'ok', resetToken: 't' })).toEqual({
      message: 'ok',
      resetToken: 't',
    });
  });
});
